# README

Aba File Reader

### What is this repository for?

- Retrieve messages and files stored on the Aba blockchain; can also be used on other clvm/chia-style blockchains like Chia

There are two storage formats that can be read.

The first is a one-coin message in text, e.g. A Cypherpunk's Manifesto

The second is a file storage of arbitrary file type that can be stored across multiple coins, even spanning gigabytes in size, for example.

## Install

npm install and create "temp" subdirectory, used by file reads for storing chunks and final files

```
npm install
mkdir temp
```

## Build code

```
npm run build
```

## Read files from the blockchain

#### Print out a one-coin message

```
npm run start read coinid
```

where coinid is the coin's hash, for example

```
npm run start read a5719fce45ef242fdd41d04fcee7c8bc14ffe5cc2edb253c6c3aadf921ed0031
```

#### Extract a file stored on multiple coins

```
npm run start get coinid
```

where coinid is the hash id of the coin containing the description.json or description.json.gz

The file will be located in the temp subdirectory of where you run it, as will the individual chunk files that make up the overall file

## Room for Improvement

- See TODO's in code comments
- Convert to Python or Rust for better performance
- Support async decoding
- Add continuation option for interrupted decodings (so you don't re-decode chunks that have already been decoded and whose sha256sum's match)

## Other Blockchains

To use with Chia blockchain, create .env file with CHAIN=chia in it

To use other chains, modify permitted chains in index.ts around line 18
