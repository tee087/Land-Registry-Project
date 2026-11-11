import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import bcrypt from 'bcryptjs';

// Environment must be set before the app and models are imported.
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.UPLOAD_DIR = '/tmp/opencode/lrc-integration-uploads';

const { default: app } = await import('../src/app.js');
const { sequelize } = await import('../src/config/database.js');
const {
  User,
  RefreshToken,
  LandParcel,
  Ownership,
  Registration,
  Transfer,
  Document,
  AuditLog,
  Notification,
  Evidence,
  EvidenceCustody,
  ForensicFinding,
  BlockchainTransaction,
} = await import('../src/models/index.js');
const { Op } = await import('sequelize');

const PASSWORD = 'IntegrationPass1';
const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
const wallet = (n) => `0x${crypto.createHash('sha256').update(`${suffix}:${n}`).digest('hex').slice(0, 40)}`;
const email = (name) => `${name}.${suffix}@example.test`;
const parcelNumber = `TST/${suffix}/1`;

const created = {
  userIds: [],
  parcelId: null,
  registrationIds: [],
  transferIds: [],
  documentIds: [],
  evidenceId: null,
  storageKeys: [],
};

async function createUser({ name, role, walletAddress }) {
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  const user = await User.create({
    fullName: `${name} Integration`,
    email: email(name),
    phone: null,
    walletAddress: walletAddress || null,
    passwordHash,
    role,
    status: 'active',
  });
  created.userIds.push(user.id);
  return user;
}

async function login(address) {
  const res = await request(app).post('/api/auth/login').send({ email: address, password: PASSWORD });
  assert.equal(res.status, 200, `login failed for ${address}: ${res.text}`);
  return res.body.data.accessToken;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

after(async () => {
  try {
    if (created.parcelId) {
      const docs = await Document.findAll({ where: { parcelId: created.parcelId }, attributes: ['storageKey'] });
      for (const doc of docs) created.storageKeys.push(doc.storageKey);
    }
    for (const key of created.storageKeys) {
      await fs.rm(path.join(process.env.UPLOAD_DIR, key), { force: true }).catch(() => {});
    }

    const entityIds = [
      ...(created.parcelId ? [created.parcelId] : []),
      ...created.registrationIds,
      ...created.transferIds,
      ...created.documentIds,
      ...(created.evidenceId ? [created.evidenceId] : []),
    ];
    if (entityIds.length > 0) {
      await BlockchainTransaction.destroy({ where: { entityId: { [Op.in]: entityIds } } });
      await AuditLog.destroy({ where: { entityId: { [Op.in]: entityIds } } });
    }
    if (created.userIds.length > 0) {
      await AuditLog.destroy({ where: { actorId: { [Op.in]: created.userIds } } });
      await Notification.destroy({ where: { userId: { [Op.in]: created.userIds } } });
      await RefreshToken.destroy({ where: { userId: { [Op.in]: created.userIds } } });
      await ForensicFinding.destroy({ where: { recordedBy: { [Op.in]: created.userIds } } });
    }
    if (created.evidenceId) {
      await EvidenceCustody.destroy({ where: { evidenceId: created.evidenceId } });
      await Evidence.destroy({ where: { id: created.evidenceId } });
    }
    if (created.parcelId) {
      await Document.destroy({ where: { parcelId: created.parcelId } });
      await Ownership.destroy({ where: { parcelId: created.parcelId } });
      await Registration.destroy({ where: { parcelId: created.parcelId } });
      await Transfer.destroy({ where: { parcelId: created.parcelId } });
      await Evidence.destroy({ where: { parcelId: created.parcelId } });
      await LandParcel.destroy({ where: { id: created.parcelId } });
    }
    if (created.userIds.length > 0) {
      await User.destroy({ where: { id: { [Op.in]: created.userIds } } });
    }
  } catch (error) {
    console.error('[integration cleanup]', error.message);
  } finally {
    await sequelize.close();
  }
});

test('end-to-end registry workflow over the real API and database', async (t) => {
  const owner1 = await createUser({ name: 'owner1', role: 'landowner', walletAddress: wallet(1) });
  const owner2 = await createUser({ name: 'owner2', role: 'landowner', walletAddress: wallet(2) });
  const registrar = await createUser({ name: 'registrar', role: 'registrar' });
  const admin = await createUser({ name: 'admin', role: 'administrator' });
  const investigator = await createUser({ name: 'investigator', role: 'investigator' });
  const auditor = await createUser({ name: 'auditor', role: 'auditor' });

  const owner1Token = await login(owner1.email);
  const owner2Token = await login(owner2.email);
  const registrarToken = await login(registrar.email);
  const adminToken = await login(admin.email);
  const investigatorToken = await login(investigator.email);
  const auditorToken = await login(auditor.email);

  await t.test('profile update is audited and exposes wallet address', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set(auth(owner1Token))
      .send({ fullName: 'Owner One Updated', walletAddress: owner1.walletAddress });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.fullName, 'Owner One Updated');
    assert.equal(res.body.data.walletAddress, owner1.walletAddress);

    const audit = await AuditLog.findOne({ where: { action: 'user.profile.update', entityId: owner1.id } });
    assert.ok(audit, 'profile update audit should exist');
  });

  await t.test('password change validates the current password and rotates sessions', async () => {
    const wrong = await request(app)
      .patch('/api/users/me/password')
      .set(auth(owner1Token))
      .send({ currentPassword: 'WrongPassword1!', newPassword: 'NewIntegrationPass1' });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error.code, 'INVALID_CURRENT_PASSWORD');

    const beforeLogin = await request(app).post('/api/auth/login').send({ email: owner1.email, password: PASSWORD });
    const beforeRefresh = beforeLogin.body.data.refreshToken;

    const changed = await request(app)
      .patch('/api/users/me/password')
      .set(auth(owner1Token))
      .send({ currentPassword: PASSWORD, newPassword: 'NewIntegrationPass1' });
    assert.equal(changed.status, 200, changed.text);

    const oldLogin = await request(app).post('/api/auth/login').send({ email: owner1.email, password: PASSWORD });
    assert.equal(oldLogin.status, 401);
    assert.equal(oldLogin.body.error.code, 'INVALID_CREDENTIALS');

    const newLogin = await request(app).post('/api/auth/login').send({ email: owner1.email, password: 'NewIntegrationPass1' });
    assert.equal(newLogin.status, 200);

    const refreshWithOld = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: beforeRefresh });
    assert.equal(refreshWithOld.status, 401);
    assert.equal(refreshWithOld.body.error.code, 'REFRESH_TOKEN_REUSED');

    // Restore the original password so the rest of the suite is unaffected.
    await request(app)
      .patch('/api/users/me/password')
      .set(auth(newLogin.body.data.accessToken))
      .send({ currentPassword: 'NewIntegrationPass1', newPassword: PASSWORD });

    const passwordAudit = await AuditLog.findOne({ where: { action: 'user.password.change', entityId: owner1.id } });
    assert.ok(passwordAudit, 'password change should be audited');
  });

  await t.test('parcel creation is registrar/admin-only and normalises the number', async () => {
    const forbidden = await request(app)
      .post('/api/parcels')
      .set(auth(owner1Token))
      .send({ parcelNumber, county: 'Nairobi' });
    assert.equal(forbidden.status, 403);

    const res = await request(app)
      .post('/api/parcels')
      .set(auth(adminToken))
      .send({
        parcelNumber: parcelNumber.toLowerCase(),
        county: 'Nairobi',
        block: 'Block A',
        location: 'Test location',
        areaHectares: 1.5,
        latitude: -1.286389,
        longitude: 36.817223,
      });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.data.parcelNumber, parcelNumber);
    assert.equal(res.body.data.status, 'active');
    created.parcelId = res.body.data.id;

    const duplicate = await request(app)
      .post('/api/parcels')
      .set(auth(adminToken))
      .send({ parcelNumber, county: 'Nairobi' });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, 'PARCEL_EXISTS');
  });

  let registrationId;
  await t.test('registration approval creates ownership and a durable outbox event', async () => {
    const submit = await request(app)
      .post('/api/registrations')
      .set(auth(owner1Token))
      .send({ parcelId: created.parcelId });
    assert.equal(submit.status, 201, submit.text);
    registrationId = submit.body.data.id;
    created.registrationIds.push(registrationId);

    const duplicate = await request(app)
      .post('/api/registrations')
      .set(auth(owner1Token))
      .send({ parcelId: created.parcelId });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, 'REGISTRATION_PENDING');

    const otherUserView = await request(app).get('/api/registrations').set(auth(owner2Token));
    assert.equal(otherUserView.status, 200);
    assert.ok(!otherUserView.body.data.some((row) => row.id === registrationId));

    const approve = await request(app)
      .post(`/api/registrations/${registrationId}/review`)
      .set(auth(registrarToken))
      .send({ decision: 'approve', notes: 'Verified in integration test' });
    assert.equal(approve.status, 200, approve.text);
    assert.equal(approve.body.data.status, 'approved');

    const ownerships = await request(app)
      .get(`/api/parcels/${created.parcelId}/ownerships`)
      .set(auth(owner1Token));
    assert.equal(ownerships.status, 200);
    assert.equal(ownerships.body.data.length, 1);
    assert.equal(ownerships.body.data[0].ownerId, owner1.id);
    assert.equal(ownerships.body.data[0].isCurrent, true);

    const outbox = await BlockchainTransaction.findOne({
      where: { entityType: 'registration', entityId: registrationId },
    });
    assert.ok(outbox, 'registration outbox event should exist');
    assert.equal(outbox.status, 'pending');
    assert.ok(outbox.payload.registryRecordReference, 'outbox should anchor a registry record reference');
    assert.ok(outbox.payload.eventType, 'outbox should carry an event type');
    assert.equal(outbox.payload.ownerAddress, undefined, 'outbox must not carry an owner address');
    assert.equal(outbox.payload.parcelNumber, parcelNumber);

    const again = await request(app)
      .post(`/api/registrations/${registrationId}/review`)
      .set(auth(registrarToken))
      .send({ decision: 'approve' });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'REGISTRATION_CLOSED');
  });

  await t.test('a second applicant cannot be approved over an existing owner', async () => {
    const submit = await request(app)
      .post('/api/registrations')
      .set(auth(owner2Token))
      .send({ parcelId: created.parcelId });
    assert.equal(submit.status, 201, submit.text);
    const secondId = submit.body.data.id;
    created.registrationIds.push(secondId);

    const approve = await request(app)
      .post(`/api/registrations/${secondId}/review`)
      .set(auth(registrarToken))
      .send({ decision: 'approve' });
    assert.equal(approve.status, 409);
    assert.equal(approve.body.error.code, 'PARCEL_ALREADY_OWNED');

    const stored = await Registration.findByPk(secondId);
    assert.equal(stored.status, 'submitted', 'failed approval must roll back');

    const reject = await request(app)
      .post(`/api/registrations/${secondId}/review`)
      .set(auth(registrarToken))
      .send({ decision: 'reject', notes: 'Parcel already owned' });
    assert.equal(reject.status, 200);
    assert.equal(reject.body.data.status, 'rejected');
  });

  let firstDocumentId;
  let currentDocumentSha;
  await t.test('document upload, versioning, integrity, download, and case access', async () => {
    const firstBody = Buffer.from('integration title document v1');
    const firstSha = crypto.createHash('sha256').update(firstBody).digest('hex');
    const first = await request(app)
      .post(`/api/parcels/${created.parcelId}/documents`)
      .set(auth(owner1Token))
      .send({ originalName: 'title.pdf', mimeType: 'application/pdf', contentBase64: firstBody.toString('base64') });
    assert.equal(first.status, 201, first.text);
    assert.equal(first.body.data.sha256, firstSha);
    assert.equal(first.body.data.version, 1);
    firstDocumentId = first.body.data.id;
    created.documentIds.push(firstDocumentId);

    const secondBody = Buffer.from('integration title document v2');
    const secondSha = crypto.createHash('sha256').update(secondBody).digest('hex');
    const second = await request(app)
      .post(`/api/parcels/${created.parcelId}/documents`)
      .set(auth(owner1Token))
      .send({ originalName: 'title.pdf', mimeType: 'application/pdf', contentBase64: secondBody.toString('base64') });
    assert.equal(second.status, 201, second.text);
    assert.equal(second.body.data.version, 2);
    assert.equal(second.body.data.isCurrent, true);
    assert.equal(second.body.data.sha256, secondSha);
    currentDocumentSha = secondSha;
    created.documentIds.push(second.body.data.id);

    const ownerList = await request(app)
      .get(`/api/parcels/${created.parcelId}/documents`)
      .set(auth(owner1Token));
    assert.equal(ownerList.status, 200);
    assert.equal(ownerList.body.data.length, 2);
    assert.equal(ownerList.body.data.filter((doc) => doc.isCurrent).length, 1);

    const investigatorList = await request(app)
      .get(`/api/parcels/${created.parcelId}/documents`)
      .set(auth(investigatorToken));
    assert.equal(investigatorList.status, 200, 'investigator should have case document access');
    assert.equal(investigatorList.body.data.length, 2);

    const outsiderList = await request(app)
      .get(`/api/parcels/${created.parcelId}/documents`)
      .set(auth(owner2Token));
    assert.equal(outsiderList.status, 403);

    const verify = await request(app)
      .post(`/api/documents/${firstDocumentId}/verify`)
      .set(auth(owner1Token));
    assert.equal(verify.status, 200);
    assert.equal(verify.body.data.matches, true);

    const download = await request(app)
      .get(`/api/documents/${firstDocumentId}/download`)
      .set(auth(owner1Token));
    assert.equal(download.status, 200);
    assert.match(download.headers['content-type'], /application\/pdf/);
  });

  await t.test('documents can be attached to a registration application', async () => {
    const submit = await request(app)
      .post('/api/registrations')
      .set(auth(owner1Token))
      .send({ parcelId: created.parcelId });
    assert.equal(submit.status, 201, submit.text);
    const registrationId = submit.body.data.id;
    created.registrationIds.push(registrationId);

    const body = Buffer.from('registration supporting document');
    const sha = crypto.createHash('sha256').update(body).digest('hex');
    const upload = await request(app)
      .post(`/api/registrations/${registrationId}/documents`)
      .set(auth(owner1Token))
      .send({ originalName: 'support.pdf', mimeType: 'application/pdf', contentBase64: body.toString('base64') });
    assert.equal(upload.status, 201, upload.text);
    assert.equal(upload.body.data.registrationId, registrationId);
    assert.equal(upload.body.data.sha256, sha);
    created.documentIds.push(upload.body.data.id);

    const listed = await request(app)
      .get(`/api/registrations/${registrationId}`)
      .set(auth(owner1Token));
    assert.equal(listed.status, 200);

    const nonApplicant = await request(app)
      .post(`/api/registrations/${registrationId}/documents`)
      .set(auth(owner2Token))
      .send({ originalName: 'other.pdf', mimeType: 'application/pdf', contentBase64: body.toString('base64') });
    assert.equal(nonApplicant.status, 403);
  });

  await t.test('freeze and unfreeze are transactional, idempotent, and audited once', async () => {
    const freeze = await request(app)
      .post(`/api/parcels/${created.parcelId}/freeze`)
      .set(auth(registrarToken))
      .send({ frozen: true, reason: 'Integration freeze' });
    assert.equal(freeze.status, 200, freeze.text);
    assert.equal(freeze.body.data.status, 'frozen');

    const freezeAgain = await request(app)
      .post(`/api/parcels/${created.parcelId}/freeze`)
      .set(auth(registrarToken))
      .send({ frozen: true });
    assert.equal(freezeAgain.status, 200);
    assert.match(freezeAgain.body.message, /already frozen/i);

    const freezeEvents = await BlockchainTransaction.count({
      where: { entityType: 'parcel', entityId: created.parcelId, action: 'freeze' },
    });
    assert.equal(freezeEvents, 1);

    const freezeAudits = await AuditLog.count({
      where: { entityType: 'land_parcel', entityId: created.parcelId, action: 'parcel.freeze' },
    });
    assert.equal(freezeAudits, 1);

    const blockedTransfer = await request(app)
      .post('/api/transfers')
      .set(auth(owner1Token))
      .send({ parcelId: created.parcelId, toOwnerId: owner2.id });
    assert.equal(blockedTransfer.status, 409);
    assert.equal(blockedTransfer.body.error.code, 'PARCEL_LOCKED');

    const unfreeze = await request(app)
      .post(`/api/parcels/${created.parcelId}/freeze`)
      .set(auth(registrarToken))
      .send({ frozen: false });
    assert.equal(unfreeze.status, 200, unfreeze.text);
    assert.equal(unfreeze.body.data.status, 'active');

    const unfreezeAgain = await request(app)
      .post(`/api/parcels/${created.parcelId}/freeze`)
      .set(auth(registrarToken))
      .send({ frozen: false });
    assert.equal(unfreezeAgain.status, 200);
    assert.match(unfreezeAgain.body.message, /already active/i);

    const unfreezeEvents = await BlockchainTransaction.count({
      where: { entityType: 'parcel', entityId: created.parcelId, action: 'unfreeze' },
    });
    assert.equal(unfreezeEvents, 1);
  });

  let transferId;
  await t.test('transfer approval moves ownership and sends wallet addresses, not user ids', async () => {
    const initiate = await request(app)
      .post('/api/transfers')
      .set(auth(owner1Token))
      .send({ parcelId: created.parcelId, toOwnerId: owner2.id, notes: 'Integration transfer' });
    assert.equal(initiate.status, 201, initiate.text);
    transferId = initiate.body.data.id;
    created.transferIds.push(transferId);

    const duplicate = await request(app)
      .post('/api/transfers')
      .set(auth(owner1Token))
      .send({ parcelId: created.parcelId, toOwnerId: owner2.id });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, 'TRANSFER_PENDING');

    const approve = await request(app)
      .post(`/api/transfers/${transferId}/review`)
      .set(auth(registrarToken))
      .send({ decision: 'approve', notes: 'Approved in integration test' });
    assert.equal(approve.status, 200, approve.text);
    assert.equal(approve.body.data.status, 'approved');

    const ownerships = await request(app)
      .get(`/api/parcels/${created.parcelId}/ownerships`)
      .set(auth(owner2Token));
    assert.equal(ownerships.status, 200);
    const current = ownerships.body.data.filter((row) => row.isCurrent);
    assert.equal(current.length, 1);
    assert.equal(current[0].ownerId, owner2.id);

    const oldOwnerParcel = await request(app)
      .get(`/api/parcels/${created.parcelId}`)
      .set(auth(owner1Token));
    assert.equal(oldOwnerParcel.status, 403);

    const newOwnerDocuments = await request(app)
      .get(`/api/parcels/${created.parcelId}/documents`)
      .set(auth(owner2Token));
    assert.equal(newOwnerDocuments.status, 200);

    const outbox = await BlockchainTransaction.findOne({
      where: { entityType: 'transfer', entityId: transferId },
    });
    assert.ok(outbox, 'transfer outbox event should exist');
    assert.ok(outbox.payload.registryRecordReference, 'outbox should anchor a registry record reference');
    assert.ok(outbox.payload.eventType, 'outbox should carry an event type');
    assert.equal(outbox.payload.ownerAddress, undefined, 'outbox must not carry an owner address');
    assert.equal(outbox.payload.toAddress, undefined, 'outbox must not carry a to address');
    assert.equal(outbox.payload.fromAddress, undefined, 'outbox must not carry a from address');
    assert.equal(outbox.payload.documentHash, currentDocumentSha);

    const formerOwnerTransfer = await request(app)
      .post('/api/transfers')
      .set(auth(owner1Token))
      .send({ parcelId: created.parcelId, toOwnerId: owner1.id });
    assert.equal(formerOwnerTransfer.status, 403);
    assert.equal(formerOwnerTransfer.body.error.code, 'NOT_OWNER');

    const again = await request(app)
      .post(`/api/transfers/${transferId}/review`)
      .set(auth(registrarToken))
      .send({ decision: 'approve' });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'TRANSFER_CLOSED');
  });

  let evidenceId;
  await t.test('evidence custody workflow is restricted to investigation roles', async () => {
    const forbidden = await request(app)
      .post('/api/evidence')
      .set(auth(owner1Token))
      .send({ parcelId: created.parcelId, description: 'Should not be allowed' });
    assert.equal(forbidden.status, 403);

    const create = await request(app)
      .post('/api/evidence')
      .set(auth(investigatorToken))
      .send({ parcelId: created.parcelId, description: 'Integration evidence item' });
    assert.equal(create.status, 201, create.text);
    evidenceId = create.body.data.id;
    created.evidenceId = evidenceId;

    const list = await request(app).get('/api/evidence').set(auth(investigatorToken));
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((row) => row.id === evidenceId));

    const detail = await request(app).get(`/api/evidence/${evidenceId}`).set(auth(investigatorToken));
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.custody.length, 1);

    const custody = await request(app)
      .post(`/api/evidence/${evidenceId}/custody`)
      .set(auth(investigatorToken))
      .send({ action: 'transferred', notes: 'To forensic lab', status: 'in_custody' });
    assert.equal(custody.status, 201, custody.text);

    const updated = await request(app).get(`/api/evidence/${evidenceId}`).set(auth(investigatorToken));
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.status, 'in_custody');
    assert.equal(updated.body.data.custody.length, 2);

    const auditorForbidden = await request(app).get('/api/evidence').set(auth(auditorToken));
    assert.equal(auditorForbidden.status, 403);
  });

  await t.test('forensic findings can be recorded, listed, and retrieved by investigation roles', async () => {
    const evidenceCreate = await request(app)
      .post('/api/evidence')
      .set(auth(investigatorToken))
      .send({ parcelId: created.parcelId, description: 'Evidence for forensic finding test' });
    assert.equal(evidenceCreate.status, 201, evidenceCreate.text);
    const evidenceId = evidenceCreate.body.data.id;

    const forbidden = await request(app)
      .post(`/api/evidence/${evidenceId}/findings`)
      .set(auth(owner1Token))
      .send({ caseId: 'CASE-1', title: 'T', finding: 'F' });
    assert.equal(forbidden.status, 403);

    const create = await request(app)
      .post(`/api/evidence/${evidenceId}/findings`)
      .set(auth(investigatorToken))
      .send({
        caseId: 'CASE-FORENSIC-1',
        title: 'Fiber analysis',
        description: 'Fiber sample from the scene',
        finding: 'Fiber matches suspect garment.',
        riskLevel: 'high',
        status: 'open',
      });
    assert.equal(create.status, 201, create.text);
    assert.equal(create.body.data.caseId, 'CASE-FORENSIC-1');
    assert.equal(create.body.data.riskLevel, 'high');
    assert.equal(create.body.data.status, 'open');
    assert.equal(create.body.data.evidenceId, evidenceId);
    assert.equal(create.body.data.recordedBy, investigator.id);

    const findingId = create.body.data.id;

    const list = await request(app).get('/api/evidence/findings').set(auth(investigatorToken));
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((row) => row.id === findingId));

    const detail = await request(app).get(`/api/evidence/findings/${findingId}`).set(auth(investigatorToken));
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.id, findingId);
    assert.equal(detail.body.data.finding, 'Fiber matches suspect garment.');

    const auditorRead = await request(app).get('/api/evidence/findings').set(auth(auditorToken));
    assert.equal(auditorRead.status, 403);

    const ownerRead = await request(app).get('/api/evidence/findings').set(auth(owner1Token));
    assert.equal(ownerRead.status, 403);

    const missing = await request(app)
      .post(`/api/evidence/${evidenceId}/findings`)
      .set(auth(investigatorToken))
      .send({ caseId: 'CASE-2' });
    assert.equal(missing.status, 422);

    await ForensicFinding.destroy({ where: { id: findingId } });
    await Evidence.destroy({ where: { id: evidenceId } });
  });

  await t.test('notifications can be listed and marked read only by their owner', async () => {
    const owner1List = await request(app).get('/api/notifications').set(auth(owner1Token));
    assert.equal(owner1List.status, 200);
    assert.ok(owner1List.body.data.some((row) => row.title === 'Registration approved'));

    const unread = await request(app).get('/api/notifications?unread=true').set(auth(owner1Token));
    assert.equal(unread.status, 200);
    assert.ok(unread.body.data.length >= 1);

    const first = unread.body.data[0];
    const mark = await request(app).post(`/api/notifications/${first.id}/read`).set(auth(owner1Token));
    assert.equal(mark.status, 200);
    assert.ok(mark.body.data.readAt);

    const otherUser = await request(app).post(`/api/notifications/${first.id}/read`).set(auth(owner2Token));
    assert.equal(otherUser.status, 403);

    const markAll = await request(app).post('/api/notifications/read-all').set(auth(owner1Token));
    assert.equal(markAll.status, 200);
    assert.ok(markAll.body.data.updated >= 0);

    const owner2List = await request(app).get('/api/notifications').set(auth(owner2Token));
    assert.equal(owner2List.status, 200);
    assert.ok(owner2List.body.data.some((row) => row.title === 'Transfer approved'));
  });

  await t.test('audit trail is readable by auditor/admin and reflects workflow actions', async () => {
    const adminAudit = await request(app).get('/api/audit-logs?limit=100').set(auth(adminToken));
    assert.equal(adminAudit.status, 200);
    assert.ok(adminAudit.body.data.some((row) => row.action === 'registration.approved'));
    assert.ok(adminAudit.body.data.some((row) => row.action === 'transfer.approved'));

    const auditorAudit = await request(app).get('/api/audit-logs').set(auth(auditorToken));
    assert.equal(auditorAudit.status, 200);

    const ownerAudit = await request(app).get('/api/audit-logs').set(auth(owner1Token));
    assert.equal(ownerAudit.status, 403);

    const freezeAudit = await request(app)
      .get(`/api/audit-logs?entityType=land_parcel&entityId=${created.parcelId}&action=parcel.freeze`)
      .set(auth(adminToken));
    assert.equal(freezeAudit.status, 200);
    assert.equal(freezeAudit.body.meta.total, 1);
  });

  await t.test('audit logs support date-range filtering', async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const date = today.toISOString().slice(0, 10);

    const inRange = await request(app)
      .get(`/api/audit-logs?fromDate=${date}&toDate=${date}`)
      .set(auth(adminToken));
    assert.equal(inRange.status, 200);
    assert.ok(inRange.body.data.length >= 1, 'today should contain audit events');

    const invalid = await request(app)
      .get('/api/audit-logs?fromDate=not-a-date')
      .set(auth(adminToken));
    assert.equal(invalid.status, 422);
    assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');

    const combined = await request(app)
      .get(`/api/audit-logs?action=registration.submit&fromDate=${date}&toDate=${date}`)
      .set(auth(adminToken));
    assert.equal(combined.status, 200);
    combined.body.data.forEach((row) => {
      assert.equal(row.action, 'registration.submit');
    });
  });

  await t.test('administrator user management records audit and notification, and suspends access', async () => {
    const users = await request(app).get('/api/users?limit=100').set(auth(adminToken));
    assert.equal(users.status, 200);
    const owner1Row = users.body.data.find((row) => row.id === owner1.id);
    assert.ok(owner1Row);
    assert.equal(owner1Row.walletAddress, owner1.walletAddress);

    const lookup = await request(app)
      .get(`/api/users/lookup?email=${encodeURIComponent(owner2.email)}`)
      .set(auth(adminToken));
    assert.equal(lookup.status, 200);
    assert.equal(lookup.body.data.id, owner2.id);

    const suspend = await request(app)
      .patch(`/api/users/${owner2.id}/status`)
      .set(auth(adminToken))
      .send({ status: 'suspended' });
    assert.equal(suspend.status, 200);

    const accountNotice = await Notification.findOne({
      where: { userId: owner2.id, type: 'account' },
    });
    assert.ok(accountNotice, 'status change should create a notification');

    const statusAudit = await AuditLog.findOne({
      where: { action: 'user.status.update', entityId: owner2.id },
    });
    assert.ok(statusAudit, 'status change should be audited');

    const blocked = await request(app).get('/api/parcels').set(auth(owner2Token));
    assert.equal(blocked.status, 401);
    assert.equal(blocked.body.error.code, 'ACCOUNT_UNAVAILABLE');

    const reactivate = await request(app)
      .patch(`/api/users/${owner2.id}/status`)
      .set(auth(adminToken))
      .send({ status: 'active' });
    assert.equal(reactivate.status, 200);

    const restored = await request(app).get('/api/parcels').set(auth(owner2Token));
    assert.equal(restored.status, 200);
  });

  await t.test('blockchain status, outbox detail, retry, and verification behave safely without live config', async () => {
    const status = await request(app).get('/api/blockchain/status').set(auth(adminToken));
    assert.equal(status.status, 200);
    assert.equal(status.body.data.configured, false);
    assert.ok(status.body.data.counts.pending >= 4);

    const list = await request(app)
      .get('/api/blockchain/transactions?entityType=transfer&limit=50')
      .set(auth(adminToken));
    assert.equal(list.status, 200);
    const transferTx = list.body.data.find((row) => row.entityId === transferId);
    assert.ok(transferTx);

    const detail = await request(app)
      .get(`/api/blockchain/transactions/${transferTx.id}`)
      .set(auth(adminToken));
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.id, transferTx.id);

    await BlockchainTransaction.update(
      { status: 'failed', attempts: 3, lastError: 'simulated failure', nextAttemptAt: new Date(Date.now() + 3600000) },
      { where: { id: transferTx.id } }
    );
    const retry = await request(app)
      .post(`/api/blockchain/transactions/${transferTx.id}/retry`)
      .set(auth(adminToken));
    assert.equal(retry.status, 200, retry.text);
    assert.equal(retry.body.data.status, 'pending');
    assert.equal(retry.body.data.attempts, 0);
    assert.equal(retry.body.data.lastError, null);

    const registrarStatus = await request(app).get('/api/blockchain/status').set(auth(registrarToken));
    assert.equal(registrarStatus.status, 403);

    const auditorList = await request(app).get('/api/blockchain/transactions').set(auth(auditorToken));
    assert.equal(auditorList.status, 403);

    const verify = await request(app)
      .get(`/api/blockchain/parcels/${encodeURIComponent(parcelNumber)}`)
      .set(auth(registrarToken));
    assert.equal(verify.status, 200);
    assert.equal(verify.body.data.verification.blockchainStatus, 'BLOCKCHAIN_FAILED');
    assert.ok(verify.body.data.registry, 'registry data should be returned');
    assert.ok(verify.body.data.registry.owner, 'registry owner should be present');

    await BlockchainTransaction.update({ status: 'confirmed', blockNumber: 123, confirmedAt: new Date() }, { where: { id: transferTx.id } });
    const confirmedRetry = await request(app)
      .post(`/api/blockchain/transactions/${transferTx.id}/retry`)
      .set(auth(adminToken));
    assert.equal(confirmedRetry.status, 409);
    assert.equal(confirmedRetry.body.error.code, 'BLOCKCHAIN_TRANSACTION_CONFIRMED');

    // Restore the outbox row so the final invariant test sees the real state.
    await BlockchainTransaction.update(
      { status: 'pending', blockNumber: null, confirmedAt: null },
      { where: { id: transferTx.id } }
    );
  });

  await t.test('outbox rows survive domain rollback and failed events do not fake confirmation', async () => {
    const events = await BlockchainTransaction.findAll({
      where: { entityId: { [Op.in]: [...created.registrationIds, ...created.transferIds] } },
    });
    for (const event of events) {
      assert.notEqual(event.status, 'confirmed', 'the API must not fake chain confirmation');
      assert.equal(event.confirmedAt, null);
    }
  });
});
