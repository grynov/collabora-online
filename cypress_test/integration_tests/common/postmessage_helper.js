/* global cy expect it */

function stubParentPostMessage(aliasName = 'postMessage') {
	cy.getFrameWindow().then(win => {
		cy.stub(win.parent, 'postMessage').as(aliasName);
	});
}

function parsePostedMessage(rawMessage) {
	if (typeof rawMessage === 'string') {
		try {
			return JSON.parse(rawMessage);
		} catch (e) {
			return null;
		}
	}

	return rawMessage;
}

function resetDocPartChangedCache(map) {
	map._lastPart = -1;
	map._lastPartCount = -1;
	map._lastPartDocType = '';
}

function expectDocPartChanged(options = {}, aliasName = 'postMessage') {
	const expectedParts = options.parts || [];
	const minPartCount = options.minPartCount || 1;
	const expectedDocType = options.docType;
	const expectedCount = options.count;

	cy.get('@' + aliasName).should(stub => {
		const docPartMessages = stub.getCalls()
			.map(call => parsePostedMessage(call.args[0]))
			.filter(msg => msg && msg.MessageId === 'Doc_PartChanged' && msg.Values);

		if (expectedCount !== undefined)
			expect(docPartMessages.length, 'unexpected Doc_PartChanged count').to.equal(expectedCount);

		expectedParts.forEach(function(part) {
			const found = docPartMessages.some(function(msg) {
				return msg.Values.Part === part
					&& Number.isInteger(msg.Values.PartCount)
					&& msg.Values.PartCount >= minPartCount
					&& (expectedDocType === undefined || msg.Values.DocType === expectedDocType);
			});

			expect(found, 'Doc_PartChanged for part ' + part + ' was not posted').to.be.true;
		});
	});
}

function expectGoToPartResponse(options = {}, aliasName = 'postMessage') {
	const expectedSuccess = options.success;
	const expectedPart = options.part;

	cy.get('@' + aliasName).should(stub => {
		const found = stub.getCalls().some(call => {
			const msg = parsePostedMessage(call.args[0]);
			if (!msg || msg.MessageId !== 'Action_GoToPart_Resp' || !msg.Values)
				return false;

			let matches = msg.Values.success === expectedSuccess && msg.Values.Part === expectedPart;
			if (!expectedSuccess) {
				matches = matches && typeof msg.Values.errorMsg === 'string' && msg.Values.errorMsg.length > 0;
			}
			return matches;
		});

		const successMsg = expectedSuccess ? 'success' : 'failure';
		expect(found, 'Action_GoToPart_Resp with ' + successMsg + ' was not posted').to.be.true;
	});
}

function postGoToPart(win, part) {
	const message = {
		'MessageId': 'Action_GoToPart',
		'Values': { 'Part': part }
	};

	win.postMessage(JSON.stringify(message), '*');
}

function expectGoToPartNavigationSuccess(options = {}, aliasName = 'postMessage') {
	const partCountProperty = options.partCountProperty || '_parts';
	const currentPartProperty = options.currentPartProperty || '_selectedPart';

	cy.get('@' + aliasName).then(stub => {
		stub.resetHistory();
	});

	cy.getFrameWindow().then(win => {
		const docLayer = win.app.map._docLayer;
		const partCount = Number.isInteger(docLayer[partCountProperty]) && docLayer[partCountProperty] > 0 ? docLayer[partCountProperty] : 1;
		const currentPart = Number.isInteger(docLayer[currentPartProperty]) ? docLayer[currentPartProperty] : 0;
		const requestedPart = partCount > 1 ? (currentPart === 0 ? 2 : 1) : 1;

		postGoToPart(win, requestedPart);

		cy.wrap(null).should(() => {
			expect(win.app.map._docLayer[currentPartProperty]).to.equal(requestedPart - 1);
		});

		expectGoToPartResponse({ success: true, part: requestedPart }, aliasName);
	});
}

function expectGoToPartFailure(part, options = {}, aliasName = 'postMessage') {
	const currentPartProperty = options.currentPartProperty || '_selectedPart';
	const expectedPart = options.expectedPart !== undefined ? options.expectedPart : part;

	cy.getFrameWindow().then(win => {
		const docLayer = win.app.map._docLayer;
		const previousPart = docLayer[currentPartProperty];

		postGoToPart(win, part);
		expectGoToPartResponse({ success: false, part: expectedPart }, aliasName);

		cy.wrap(null).should(() => {
			expect(win.app.map._docLayer[currentPartProperty]).to.equal(previousPart);
		});
	});
}

function addGoToPartPostMessageTests(options = {}) {
	const viewerSuffix = options.viewer ? ' in ' + options.viewer : '';
	const navigationOptions = options.navigationOptions || {};
	const currentPartProperty = navigationOptions.currentPartProperty || '_selectedPart';
	const invalidPart = options.invalidPart !== undefined ? options.invalidPart : 'invalid';
	const outOfRangePart = options.outOfRangePart !== undefined ? options.outOfRangePart : 9999;
	const nonPositivePart = options.nonPositivePart !== undefined ? options.nonPositivePart : 0;

	it('Action_GoToPart postMessage navigates to requested part' + viewerSuffix, function() {
		stubParentPostMessage();
		expectGoToPartNavigationSuccess(navigationOptions);
	});

	it('Action_GoToPart postMessage fails for invalid part' + viewerSuffix, function() {
		stubParentPostMessage();
		expectGoToPartFailure(invalidPart, {
			currentPartProperty: currentPartProperty,
			expectedPart: null
		});
	});

	it('Action_GoToPart postMessage fails for out-of-range part' + viewerSuffix, function() {
		stubParentPostMessage();
		expectGoToPartFailure(outOfRangePart, {
			currentPartProperty: currentPartProperty
		});
	});

	it('Action_GoToPart postMessage fails for non-positive part' + viewerSuffix, function() {
		stubParentPostMessage();
		expectGoToPartFailure(nonPositivePart, {
			currentPartProperty: currentPartProperty
		});
	});
}

const _stubParentPostMessage = stubParentPostMessage;
export { _stubParentPostMessage as stubParentPostMessage };
const _expectDocPartChanged = expectDocPartChanged;
export { _expectDocPartChanged as expectDocPartChanged };
const _resetDocPartChangedCache = resetDocPartChangedCache;
export { _resetDocPartChangedCache as resetDocPartChangedCache };
const _addGoToPartPostMessageTests = addGoToPartPostMessageTests;
export { _addGoToPartPostMessageTests as addGoToPartPostMessageTests };
