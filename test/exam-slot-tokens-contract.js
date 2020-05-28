/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { ChaincodeStub, ClientIdentity } = require('fabric-shim');
const { ExamSlotTokensContract } = require('..');
const winston = require('winston');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

chai.should();
chai.use(chaiAsPromised);
chai.use(sinonChai);

class TestContext {

    constructor() {
        this.stub = sinon.createStubInstance(ChaincodeStub);
        this.clientIdentity = sinon.createStubInstance(ClientIdentity);
        this.logging = {
            getLogger: sinon.stub().returns(sinon.createStubInstance(winston.createLogger().constructor)),
            setLevel: sinon.stub(),
        };
    }

}

let testExams = [
    {
        date: new Date(2020, 4, 31, 10).toISOString(), tokens: [
            { owner: '1', requestedBy: null },
            { owner: '2', requestedBy: '4' },
            { owner: '3', requestedBy: null },
            { owner: null, requestedBy: null },
            { owner: null, requestedBy: null },
        ]
    },
    {
        date: new Date(2020, 5, 1, 10).toISOString(), tokens: [
            { owner: '5', requestedBy: null },
            { owner: '6', requestedBy: '8' },
            { owner: '7', requestedBy: null },
            { owner: null, requestedBy: null },
            { owner: null, requestedBy: null },
        ]
    }
];

let testCoins = [
    { id: '1', wallet: 1000 },
    { id: '2', wallet: 1000 },
    { id: '3', wallet: 1000 },
    { id: '4', wallet: 10000 },
    { id: '5', wallet: 1000 },
    { id: '6', wallet: 1000 },
    { id: '7', wallet: 1000 },
    { id: '8', wallet: 0 },
];

describe('ExamSlotTokensContract', () => {

    let contract;
    let ctx;

    beforeEach(() => {
        contract = new ExamSlotTokensContract();
        ctx = new TestContext();


        testExams = [
            {
                date: new Date(2020, 4, 31, 10).toISOString(), tokens: [
                    { owner: '1', requestedBy: null },
                    { owner: '2', requestedBy: '4' },
                    { owner: '3', requestedBy: '7' },
                    { owner: null, requestedBy: null },
                    { owner: null, requestedBy: null },
                ]
            },
            {
                date: new Date(2020, 5, 1, 10).toISOString(), tokens: [
                    { owner: '5', requestedBy: null },
                    { owner: '6', requestedBy: '8' },
                    { owner: '7', requestedBy: null }
                ]
            }
        ];

        testCoins = [
            { id: '1', wallet: 1000 },
            { id: '2', wallet: 1000 },
            { id: '3', wallet: 1000 },
            { id: '4', wallet: 10000 },
            { id: '5', wallet: 1000 },
            { id: '6', wallet: 1000 },
            { id: '7', wallet: 1000 },
            { id: '8', wallet: 10 },
            { id: '9', wallet: 1000 },
        ];

        ctx.clientIdentity.getID = function () { return '1'; };

        ctx.stub.getState.withArgs('EXAMS').resolves(Buffer.from(JSON.stringify(testExams)));
        ctx.stub.getState.withArgs('COINS').resolves(Buffer.from(JSON.stringify(testCoins)));
    });

    describe('#register', () => {
        it('user should be registred', async () => {
            ctx.clientIdentity.getID = function () { return '10'; };
            await contract.register(ctx);
            testCoins.push({ id: '10', wallet: 2000 });
            ctx.stub.putState.should.have.been.calledOnceWithExactly('COINS', Buffer.from(JSON.stringify(testCoins)));
        });


        it('should throw if user is registered', async () => {
            await contract.register(ctx).should.be.rejectedWith(/User is already registered/);
        });

    });

    describe('#doIHaveAClientId', () => {

        it('should return a client id', async () => {
            (await contract.getClientId(ctx)).should.equal('1');
        });
    });

    describe('#getWallet', () => {
        it('should return a wallet', async () => {
            await contract.getAccountWallet(ctx).should.eventually.equal(1000);
        });

        it('should throw if user does not exist', async () => {
            ctx.clientIdentity.getID = function () { return 'hibliblihablalbla'; };
            await contract.getAccountWallet(ctx).should.be.rejectedWith(/User is not registered/);
        });
    });

    describe('#getMyToken', () => {

        it('should return a token', async () => {
            await contract.getMyToken(ctx).should.eventually.deep.equal({ owner: '1', requestedBy: null });
        });

        it('should return null when invalid client', async () => {
            ctx.clientIdentity.getID = function () { return '8'; };
            await contract.getMyToken(ctx).should.eventually.equal(null);
        });
    });

    describe('#createExamSlots', () => {
        it('shoud create an exam slot', async () => {
            await contract.createExamSlot(ctx, 2020, 4, 29, 12, 2);
            testExams.push({ date: new Date(2020, 4, 29, 12).toISOString(), tokens: new Array(2).fill({ owner: null, requestedBy: null }) });
            ctx.stub.putState.should.have.been.calledOnceWithExactly('EXAMS', Buffer.from(JSON.stringify(testExams)));
        });

        it('should throw an exception if an exam collides with an already existing one', async () => {
            await contract.createExamSlot(ctx, 2020, 4, 31, 10, 100).should.be.rejectedWith(/Cannot create exam on the same date/);
        });
    });

    describe('#extendExamSlot', () => {
        it('shoud extend an exam slot', async () => {
            await contract.extendExamSlot(ctx, 2020, 4, 31, 10, 2);
            testExams[0] = {
                date: new Date(2020, 4, 31, 10).toISOString(), tokens: [
                    { owner: null, requestedBy: null },
                    { owner: null, requestedBy: null },
                    { owner: '1', requestedBy: null },
                    { owner: '2', requestedBy: '4' },
                    { owner: '3', requestedBy: '7' },
                    { owner: null, requestedBy: null },
                    { owner: null, requestedBy: null }
                ]
            };
            ctx.stub.putState.should.have.been.calledOnceWithExactly('EXAMS', Buffer.from(JSON.stringify(testExams)));
        });

        it('should throw an exception if exam does not exist', async () => {
            await contract.extendExamSlot(ctx, 2020, 0, 31, 10, 100).should.be.rejectedWith(/The requested exam does not exist/);
        });
    });
    describe('#applyForExam', () => {
        it('student should acquire a token', async () => {
            ctx.clientIdentity.getID = function () { return '8'; };
            await contract.applyForExam(ctx, 2020, 4, 31, 10);
            testExams[0] = {
                date: new Date(2020, 4, 31, 10).toISOString(), tokens: [
                    { owner: '1', requestedBy: null },
                    { owner: '2', requestedBy: '4' },
                    { owner: '3', requestedBy: '7' },
                    { owner: '8', requestedBy: null },
                    { owner: null, requestedBy: null }
                ]
            };
            ctx.stub.putState.should.have.been.calledOnceWithExactly('EXAMS', Buffer.from(JSON.stringify(testExams)));
        });

        it('should throw an exception if user already has a token', async () => {
            await contract.applyForExam(ctx, 2020, 4, 31, 10).should.be.rejectedWith(/You already have a token!/);
        });

        it('should throw an exception if user already has a token', async () => {
            await contract.applyForExam(ctx, 2020, 5, 1, 10).should.be.rejectedWith(/You already have a token!/);
        });

        it('should throw an exception if slot is full', async () => {
            ctx.clientIdentity.getID = function () { return '8'; };
            await contract.applyForExam(ctx, 2020, 5, 1, 10).should.be.rejectedWith(/Exam slot is full :\(/);
        });
    });

    describe('#burnExamToken', () => {
        it('tokens should be burnt', async () => {
            await contract.burnExamTokens(ctx, 2020, 4, 31, 10);
            testExams[0].tokens = [];
            ctx.stub.putState.should.have.been.calledOnceWithExactly('EXAMS', Buffer.from(JSON.stringify(testExams)));
        });

        it('should throw if exam doesn\'t exist', async () => {
            await contract.burnExamTokens(ctx, 2020, 4, 31, 11).should.be.rejectedWith(/The requested exam does not exist/);
        });
    });

    describe('#changeExamTokenOwner', () => {
        it('tokens should change owner', async () => {
            ctx.clientIdentity.getID = function () { return '2'; };
            await contract.sellMyExamToken(ctx);
            testExams[0].tokens = [
                { owner: '1', requestedBy: null },
                { owner: '4', requestedBy: null },
                { owner: '3', requestedBy: '7' },
                { owner: null, requestedBy: null },
                { owner: null, requestedBy: null }];
            ctx.stub.putState.should.have.been.calledWith('EXAMS', Buffer.from(JSON.stringify(testExams)));
        });
        it('money should be transferred', async () => {
            ctx.clientIdentity.getID = function () { return '2'; };
            await contract.sellMyExamToken(ctx);
            testCoins[1].wallet += 1000;
            testCoins[3].wallet -= 1000;
            ctx.stub.putState.should.have.been.calledWith('COINS', Buffer.from(JSON.stringify(testCoins)));
        });

        it('should throw if nobody requested token', async () => {
            await contract.sellMyExamToken(ctx).should.be.rejectedWith(/Nobody needs your token :P/);
        });
        it('should throw requester doesn\'t have money', async () => {
            ctx.clientIdentity.getID = function () { return '6'; };
            await contract.sellMyExamToken(ctx).should.be.rejectedWith(/Requester does not have the required balance/);
        });
        it('should throw requester already has a token', async () => {
            ctx.clientIdentity.getID = function () { return '3'; };
            await contract.sellMyExamToken(ctx).should.be.rejectedWith(/Requester already has a token/);
        });
    });

    describe('#requestToken', () => {
        it('request should be successful', async () => {
            ctx.clientIdentity.getID = function () { return '4'; };
            await contract.requestToken(ctx, '1');
            testExams[0].tokens = [
                { owner: '1', requestedBy: '4' },
                { owner: '2', requestedBy: '4' },
                { owner: '3', requestedBy: '7' },
                { owner: null, requestedBy: null },
                { owner: null, requestedBy: null },];
            ctx.stub.putState.should.have.been.calledOnceWithExactly('EXAMS', Buffer.from(JSON.stringify(testExams)));
        });

        it('should throw if requested does not have a token', async () => {
            await contract.requestToken(ctx, '4').should.be.rejectedWith(/This user does not posess a token/);
        });
    });
});