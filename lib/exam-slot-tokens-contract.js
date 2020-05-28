/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const EXAMS_KEY = 'EXAMS';
const COINS_KEY = 'COINS';

const tokenPrice = 1000;
const initialWallet = 2000;
const { Contract } = require('fabric-contract-api');


async function getMyToken(ctx) {
    const clientId = ctx.clientIdentity.getID();
    const examBytes = await ctx.stub.getState(EXAMS_KEY);

    const exams = JSON.parse(examBytes.toString());
    for (const exam of exams)
        for (const token of exam.tokens)
            if (token.owner === clientId)
                return token;
    return null;
}

class ExamSlotTokensContract extends Contract {


    async register(ctx) {
        const id = ctx.clientIdentity.getID();
        const usersBuffer = await ctx.stub.getState(COINS_KEY);
        let users = [];
        if (usersBuffer && usersBuffer.length !== 0)
            users = JSON.parse(usersBuffer.toString());

        if (users.find(user => user.id === id)) throw new Error('User is already registered');

        users.push({ id, wallet: initialWallet });
        ctx.stub.putState(COINS_KEY, Buffer.from(JSON.stringify(users)));
    }

    async createExamSlot(ctx, year, month, day, hour, numberOfPlaces) {
        const date = new Date(year, month, day, hour).toISOString();

        const examBytes = await ctx.stub.getState(EXAMS_KEY);
        let exams = [];
        if (examBytes && examBytes.length !== 0)
            exams = JSON.parse(examBytes.toString());

        if (exams.find(exam => exam.date === date)) throw new Error('Cannot create exam on the same date');

        exams.push({ date, tokens: new Array(numberOfPlaces).fill({ owner: null, requestedBy: null }) });
        await ctx.stub.putState(EXAMS_KEY, Buffer.from(JSON.stringify(exams)));
    }

    async extendExamSlot(ctx, year, month, day, hour, numberOfPlaces) {
        const date = new Date(year, month, day, hour).toISOString();

        const examBytes = await ctx.stub.getState(EXAMS_KEY);
        const exams = JSON.parse(examBytes.toString());

        const exam = exams.find(exam => exam.date === date);
        if (!exam) throw new Error('The requested exam does not exist');

        exam.tokens = [...new Array(numberOfPlaces).fill({ owner: null, requestedBy: null }), ...exam.tokens];
        await ctx.stub.putState(EXAMS_KEY, Buffer.from(JSON.stringify(exams)));
    }

    async getMyToken(ctx) {
        return getMyToken(ctx);
    }

    async applyForExam(ctx, year, month, day, hour) {
        // TODO: check date
        const date = new Date(year, month, day, hour).toISOString();

        const examBytes = await ctx.stub.getState(EXAMS_KEY);

        const exams = JSON.parse(examBytes.toString());
        const exam = exams.find(exam => exam.date === date);
        if (!exam) throw new Error('The requested exam does not exist');
        if (await getMyToken(ctx)) throw new Error('You already have a token!');

        const token = exam.tokens.find(t => t.owner === null);
        if (!token) throw new Error('Exam slot is full :(');

        token.owner = ctx.clientIdentity.getID();
        await ctx.stub.putState(EXAMS_KEY, Buffer.from(JSON.stringify(exams)));
    }

    async burnExamTokens(ctx, year, month, day, hour) {
        const date = new Date(year, month, day, hour).toISOString();

        const examBytes = await ctx.stub.getState(EXAMS_KEY);

        const exams = JSON.parse(examBytes.toString());
        const exam = exams.find(exam => exam.date === date);
        if (!exam) throw new Error('The requested exam does not exist');
        exam.tokens = [];

        await ctx.stub.putState(EXAMS_KEY, Buffer.from(JSON.stringify(exams)));
    }

    async getClientId(ctx) {
        return ctx.clientIdentity.getID();
    }
    async getAccountWallet(ctx) {
        const usersBytes = await ctx.stub.getState(COINS_KEY);
        const users = JSON.parse(usersBytes.toString());
        const user = users.find(user => user.id === ctx.clientIdentity.getID());
        if (!user) throw new Error('User is not registered');
        return user.wallet;
    }

    async sellMyExamToken(ctx) {
        const clientId = ctx.clientIdentity.getID();
        const examBytes = await ctx.stub.getState(EXAMS_KEY);

        const exams = JSON.parse(examBytes.toString());
        let myToken;
        for (const exam of exams)
            for (const token of exam.tokens)
                if (token.owner === clientId)
                    myToken = token;
        if (!myToken) throw new Error('You don\'t have a token');

        if (myToken.requestedBy !== null) {
            for (const exam of exams)
                for (const token of exam.tokens)
                    if (token.owner === myToken.requestedBy)
                        throw new Error('Requester already has a token');

            const usersBytes = await ctx.stub.getState(COINS_KEY);
            const users = JSON.parse(usersBytes.toString());

            const me = users.find(user => user.id === ctx.clientIdentity.getID());
            const requester = users.find(user => user.id === myToken.requestedBy);

            if (!requester) throw new Error('Requester is not registered');
            if (requester.wallet < tokenPrice) throw new Error('Requester does not have the required balance');

            requester.wallet -= tokenPrice;
            me.wallet += tokenPrice;

            myToken.owner = myToken.requestedBy;
            myToken.requestedBy = null;

            await ctx.stub.putState(EXAMS_KEY, Buffer.from(JSON.stringify(exams)));
            await ctx.stub.putState(COINS_KEY, Buffer.from(JSON.stringify(users)));
        }
        else throw new Error('Nobody needs your token :P');
    }

    async requestToken(ctx, owner) {
        const examBytes = await ctx.stub.getState(EXAMS_KEY);
        const exams = JSON.parse(examBytes.toString());

        let token = null;
        for (const exam of exams)
            for (const t of exam.tokens)
                if (t.owner === owner) {
                    token = t;
                    break;
                }
        if (!token) throw new Error('This user does not posess a token');
        token.requestedBy = ctx.clientIdentity.getID();
        await ctx.stub.putState(EXAMS_KEY, Buffer.from(JSON.stringify(exams)));
    }
}

module.exports = ExamSlotTokensContract;
