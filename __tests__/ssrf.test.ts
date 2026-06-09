import { describe, it, expect } from 'vitest';
import { isPrivateIp } from '@/lib/ssrf';

describe('isPrivateIp — IPv4 privati/loopback', () => {
  it('blocca i range privati RFC1918', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('10.255.255.255')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
    expect(isPrivateIp('192.168.0.1')).toBe(true);
    expect(isPrivateIp('192.168.255.255')).toBe(true);
  });

  it('blocca loopback, link-local e 0.0.0.0/8', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('127.255.255.255')).toBe(true);
    expect(isPrivateIp('169.254.1.1')).toBe(true);
    expect(isPrivateIp('0.0.0.0')).toBe(true);
  });

  it('rispetta i confini del range 172.16-31', () => {
    expect(isPrivateIp('172.15.0.1')).toBe(false); // appena sotto
    expect(isPrivateIp('172.16.0.0')).toBe(true);  // inizio range
    expect(isPrivateIp('172.31.0.0')).toBe(true);  // fine range
    expect(isPrivateIp('172.32.0.1')).toBe(false); // appena sopra
  });

  it('lascia passare gli IP pubblici', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
    expect(isPrivateIp('142.250.180.46')).toBe(false); // google
    expect(isPrivateIp('192.169.0.1')).toBe(false);    // non 192.168
  });
});

describe('isPrivateIp — IPv6', () => {
  it('blocca loopback, link-local e ULA', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
    expect(isPrivateIp('fc00::1')).toBe(true);
    expect(isPrivateIp('fd12:3456::1')).toBe(true);
  });

  it('lascia passare IPv6 pubblici', () => {
    expect(isPrivateIp('2001:4860:4860::8888')).toBe(false); // google DNS
  });
});

describe('isPrivateIp — input malformato', () => {
  it('non lancia e ritorna false su stringhe non-IP', () => {
    expect(isPrivateIp('notanip')).toBe(false);
    expect(isPrivateIp('')).toBe(false);
    expect(isPrivateIp('10.0.0')).toBe(false);
  });
});
