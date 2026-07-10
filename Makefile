.PHONY: build test ci clean

build:
	node scripts/build.mjs

test:
	node scripts/run-tests.mjs

ci:
	node scripts/check-js.mjs
	node scripts/run-tests.mjs

clean:
	rm -rf build .test-build
