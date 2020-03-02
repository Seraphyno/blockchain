const Blockchain = require('./index')
const Block = require('./block')
const Wallet = require('../wallet')
const Transaction = require('../wallet/transaction')
const { cryptoHash } = require('../util')

describe('Blockchain', () => {
  let blockchain, newChain, originalChain, errorMock;

  beforeEach(() => {
    blockchain = new Blockchain()
    newChain = new Blockchain();
    originalChain = blockchain.chain;
    errorMock = jest.fn();

    global.console.error = errorMock;
  })

  it('contains a chain array instance', () => {
    expect(blockchain.chain instanceof Array).toBe(true)
  })

  it('starts with genesis()', () => {
    expect(blockchain.chain[0]).toEqual(Block.genesis())
  })

  it('can add a block successfully', () => {
    const newData = 'foo-bar'

    blockchain.addBlock({ data: newData })

    expect(blockchain.chain[blockchain.chain.length - 1].data).toEqual(newData)
  })

  describe('isValidChain()', () => {
    beforeEach(() => {
      blockchain.addBlock({ data: 'Bears' })
      blockchain.addBlock({ data: 'Bear' })
      blockchain.addBlock({ data: 'Bea' })
    })

    describe('when it does not start with genesis', () => {
      it('should return false', () => {
        blockchain.chain[0] = { data: 'fake-genesis' }

        expect(Blockchain.isValidChain(blockchain.chain)).toBe(false)
      })
    })

    describe('when it starts with genesis and has multiple blocks', () => {
      describe('and the lastHash has changed', () => {
        it('should return false', () => {
          blockchain.chain[2].lastHash = 'broken-hash'

          expect(Blockchain.isValidChain(blockchain.chain)).toBe(false)
        })
      })

      describe('and it has an illegal field', () => {
        it('should return false', () => {
          blockchain.chain[2].data = 'some-bad-data'

          expect(Blockchain.isValidChain(blockchain.chain)).toBe(false)
        })
      })

      describe('and it does not contain invalid blocks', () => {
        it('should return true', () => {
          expect(Blockchain.isValidChain(blockchain.chain)).toBe(true)
        })
      })

      describe('and the chaing contains a block with jumped difficulty', () => {
        it('returns false', () => {
          const lastBlock = blockchain.chain[blockchain.chain.length - 1];
          const lastHash = lastBlock.hash;
          const timestamp = Date.now();
          const nonce = 0;
          const data = [];
          const difficulty = lastBlock.difficulty - 3;
          const hash = cryptoHash(timestamp, lastHash, difficulty, nonce, data);

          const badBlock = new Block({ timestamp, lastHash, hash, nonce, difficulty, data })

          blockchain.chain.push(badBlock);

          expect(Blockchain.isValidChain(blockchain.chain)).toBe(false)
        })
      })
    })
  })

  describe('replaceChain()', () => {
    let logMock;

    beforeEach(() => {
      logMock = jest.fn()

      global.console.log = logMock
    })

    describe('when the chain is not longer', () => {
      beforeEach(() => {
        newChain.chain[0] = { new: 'chain' }
        blockchain.replaceChain(newChain.chain)
      })

      it('does not replace the chain', () => {
        expect(blockchain.chain).toEqual(originalChain)
      })

      it('logs an error', () => {
        expect(errorMock).toHaveBeenCalled()
      })
    })

    describe('when the new chain is longer', () => {
      beforeEach(() => {
        newChain.addBlock({ data: 'Bears' })
        newChain.addBlock({ data: 'Bear' })
        newChain.addBlock({ data: 'Bea' })
      })

      describe('and the chain is invalid', () => {
        beforeEach(() => {
          newChain.chain[2].hash = 'fake-hash'
          blockchain.replaceChain(newChain.chain)
        })

        it('does not replace the chain', () => {
          expect(blockchain.chain).toEqual(originalChain)
        })

        it('logs an error', () => {
          expect(errorMock).toHaveBeenCalled()
        })
      })

      describe('and the chain is valid', () => {
        beforeEach(() => {
          blockchain.replaceChain(newChain.chain)
        })

        it('does replace the chain', () => {
          expect(blockchain.chain).toEqual(newChain.chain)
        })

        it('logs a message', () => {
          expect(logMock).toHaveBeenCalled()
        })
      })
    })

    describe('and the `validateTransactions` flag is set to true', () => {
      it('should call validTransactionData()', () => {
        const validTransactionDataMock = jest.fn();

        blockchain.validTransactionData = validTransactionDataMock;
        
        newChain.addBlock({ data: 'foo' });
        blockchain.replaceChain(newChain.chain, true);

        expect(validTransactionDataMock).toHaveBeenCalled();
      })
    })
  });

  describe('validTransactionData()', () => {
    let transaction, rewardTransaction, wallet;

    beforeEach(() => {
      wallet = new Wallet();
      transaction = wallet.createTransaction({ recipient: 'foo-address', amount: 65 });
      rewardTransaction = Transaction.rewardTransaction({ minerWallet: wallet });
    });

    describe('where the transaction data is valid', () => {
      it('returns true', () => {
        newChain.addBlock({ data: [transaction, rewardTransaction] });
        expect(blockchain.validTransactionData({ chain: newChain.chain })).toBe(true);
        expect(errorMock).not.toHaveBeenCalled();
      })
    });

    describe('and the transaction data has multiple rewards', () => {
      it('returns false and logs an error', () => {
        newChain.addBlock({ data: [transaction, rewardTransaction, rewardTransaction] });

        expect(blockchain.validTransactionData({ chain: newChain.chain })).toBe(false);
        expect(errorMock).toHaveBeenCalled();
      });
    });

    describe('and the transaction data has at least one malformed outputMap', () => {
      describe('and the transaction is not a reward transaction', () => {
        it('returns false and logs an error', () => {
          transaction.outputMap[wallet.publicKey] = 999999;
          newChain.addBlock({ data: [transaction, rewardTransaction] });

          expect(blockchain.validTransactionData({ chain: newChain.chain })).toBe(false);
          expect(errorMock).toHaveBeenCalled();
        });
      });

      describe('and the transaction is a reward transaction', () => {
        it('returns false and logs an error', () => {
          rewardTransaction.outputMap[wallet.publicKey] = 999999;
          newChain.addBlock({ data: [transaction, rewardTransaction] });

          expect(blockchain.validTransactionData({ chain: newChain.chain })).toBe(false);
          expect(errorMock).toHaveBeenCalled();
        });
      });
    });

    describe('and the transaction data has at least one malformed input', () => {
      it('returns false and logs an error', () => {
        wallet.balance = 9000;
        const evilOutputMap = {
          [wallet.publicKey]: 8900,
          fooRecipient: 100
        }

        const evilTransaction = {
          input: {
            timestamp: Date.now(),
            amount: wallet.balance,
            address: wallet.publicKey,
            signature: wallet.sign(evilOutputMap)
          },
          outputMap: evilOutputMap
        }

        newChain.addBlock({ data: [evilTransaction, rewardTransaction] });

        expect(blockchain.validTransactionData({ chain: newChain.chain })).toBe(false);
        expect(errorMock).toHaveBeenCalled();
      });
    });

    describe('and a block contains multiple identical transactions', () => {
      it('returns false and logs an error', () => {
        newChain.addBlock({ data: [transaction, transaction, transaction, rewardTransaction] });

        expect(blockchain.validTransactionData({ chain: newChain.chain })).toBe(false);
        expect(errorMock).toHaveBeenCalled();
      });
    });
  })
})