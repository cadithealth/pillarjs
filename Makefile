TESTS = test/test.js pillar.js

test:
	mocha --reporter spec $(TESTS)

test-w:
	mocha --reporter spec -w $(TESTS)

.PHONY: test test-w
