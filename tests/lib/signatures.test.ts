import { describe, expect, it } from 'vitest';
import { signRazorpayBody, verifyRazorpaySignature } from '@/lib/razorpay/verify';
import { verifyWhatsAppSignature } from '@/lib/whatsapp/verify';

// Expected digests computed independently: printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET"
const META_BODY = '{"object":"whatsapp_business_account","entry":[]}';
const META_SECRET = 'test_app_secret';
const META_SIG = 'dec6a680679a968e7e0319355b23599cbfc54502c0784668e9618baa0c633756';

const RZP_BODY = '{"event":"payment_link.paid","payload":{}}';
const RZP_SECRET = 'test_webhook_secret';
const RZP_SIG = 'a43b353bb7c52eb340f6f3a58c821ceb163416441c5326e6bc0609c0e1d953b8';

describe('verifyWhatsAppSignature', () => {
  it('accepts a correct sha256= header (string or Buffer body, any hex case)', () => {
    expect(verifyWhatsAppSignature(META_BODY, `sha256=${META_SIG}`, META_SECRET)).toBe(true);
    expect(verifyWhatsAppSignature(Buffer.from(META_BODY), `sha256=${META_SIG}`, META_SECRET)).toBe(
      true,
    );
    expect(
      verifyWhatsAppSignature(META_BODY, `sha256=${META_SIG.toUpperCase()}`, META_SECRET),
    ).toBe(true);
  });

  it('rejects tampered body, wrong secret, and malformed or missing headers', () => {
    expect(verifyWhatsAppSignature(`${META_BODY} `, `sha256=${META_SIG}`, META_SECRET)).toBe(false);
    expect(verifyWhatsAppSignature(META_BODY, `sha256=${META_SIG}`, 'other_secret')).toBe(false);
    expect(verifyWhatsAppSignature(META_BODY, META_SIG, META_SECRET)).toBe(false); // no prefix
    expect(verifyWhatsAppSignature(META_BODY, `sha1=${META_SIG}`, META_SECRET)).toBe(false);
    expect(verifyWhatsAppSignature(META_BODY, `sha256=${META_SIG.slice(2)}`, META_SECRET)).toBe(
      false,
    );
    expect(verifyWhatsAppSignature(META_BODY, 'sha256=zz', META_SECRET)).toBe(false);
    expect(verifyWhatsAppSignature(META_BODY, '', META_SECRET)).toBe(false);
    expect(verifyWhatsAppSignature(META_BODY, null, META_SECRET)).toBe(false);
  });
});

describe('verifyRazorpaySignature', () => {
  it('accepts a correct signature', () => {
    expect(verifyRazorpaySignature(RZP_BODY, RZP_SIG, RZP_SECRET)).toBe(true);
    expect(verifyRazorpaySignature(Buffer.from(RZP_BODY), RZP_SIG, RZP_SECRET)).toBe(true);
  });

  it('rejects tampered body, wrong secret, and malformed or missing signatures', () => {
    expect(verifyRazorpaySignature(RZP_BODY.replace('paid', 'expired'), RZP_SIG, RZP_SECRET)).toBe(
      false,
    );
    expect(verifyRazorpaySignature(RZP_BODY, RZP_SIG, 'other_secret')).toBe(false);
    expect(verifyRazorpaySignature(RZP_BODY, RZP_SIG.slice(1), RZP_SECRET)).toBe(false);
    expect(verifyRazorpaySignature(RZP_BODY, `sha256=${RZP_SIG}`, RZP_SECRET)).toBe(false);
    expect(verifyRazorpaySignature(RZP_BODY, undefined, RZP_SECRET)).toBe(false);
  });

  it('signRazorpayBody produces what the verifier accepts', () => {
    expect(signRazorpayBody(RZP_BODY, RZP_SECRET)).toBe(RZP_SIG);
  });
});
