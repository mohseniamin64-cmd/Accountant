import {describe, expect, it} from 'vitest';
import {isLoopbackAddress} from './launch.js';

describe('recovery launch address restriction', () => {
  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])(
    'accepts loopback address %s',
    (address) => {
      expect(isLoopbackAddress(address)).toBe(true);
    },
  );

  it.each(['192.168.1.12', '10.0.0.2', '', null, undefined])(
    'rejects non-loopback address %s',
    (address) => {
      expect(isLoopbackAddress(address)).toBe(false);
    },
  );
});
