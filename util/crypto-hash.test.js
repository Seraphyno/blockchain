const cryptoHash = require('./crypto-hash')

describe('cryptoHash()', () => {
  it('generates a SHA-256', () => {
    expect(cryptoHash('foo'))
      .toEqual('b2213295d564916f89a6a42455567c87c3f480fcd7a1c15e220f17d7169a790b')
  });

  it('produces the same hash for the same data', () => {
    expect(cryptoHash('one', 'two', 'three')).toEqual(cryptoHash('three', 'one', 'two'))
  });

  it('produces a new hash when the properties have changed on input', () => {
    const foo = {};
    const originalHash = cryptoHash(foo);
    foo['a'] = 'a';

    expect(originalHash).not.toEqual(cryptoHash(foo));
  })
});
