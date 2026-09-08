import { it, expect } from 'vitest';
import { chromeArguments } from '../tesco-browser.mjs';
it('keeps Chrome sandbox enabled and debugging confined to a dedicated loopback profile', () => {
  const args = chromeArguments('C:/test-profile', 12345);
  expect(args).toContain('--user-data-dir=C:/test-profile');
  expect(args).toContain('--remote-debugging-address=127.0.0.1');
  expect(args).not.toContain('--no-sandbox');
  expect(args).not.toContain('--enable-automation');
  expect(args).not.toContain('--headless=new');
});
