const Blockchain = require('../blockchain')

const blockchain = new Blockchain();

blockchain.addBlock({ data: 'initial' })

console.log('first block', blockchain.chain[0])

let previousTimestamp, nextTimestamp, nextBlock, timeDiff, average;
const times = [];

for (let i = 0; i < 10000; i++) {
  previousTimestamp = blockchain.chain[blockchain.chain.length - 1].timestamp;

  blockchain.addBlock({ data: `block ${i}` });
  nextBlock = blockchain.chain[blockchain.chain.length - 1];
  
  nextTimestamp = nextBlock.timestamp;
  timeDiff = nextTimestamp - previousTimestamp;
  times.push(timeDiff);

  average = times.reduce((total, number) => (total + number)) / times.length;

  console.log(`Time to mine block: ${timeDiff}ms. Difficulty: ${nextBlock.difficulty}. Average time: ${average}ms`)
}