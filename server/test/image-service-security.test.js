import test from 'node:test';
import assert from 'node:assert/strict';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';

async function imageService() {
  const module = await import('../src/services/image.service.js');
  return module.default;
}

test('ImageService accepts valid PNG data and stores it with a server-selected extension', async () => {
  const service = await imageService();
  const png =
    'data:image/png;base64,' +
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

  const url = await service.base64ToFile(png, 'security_test');

  assert.match(url, /^\/uploads\/images\/security_test_\d+_[a-f0-9]{12}\.png$/);

  const filename = url.split('/').pop();
  await unlink(resolve(process.cwd(), 'uploads', 'images', filename));
});

test('ImageService rejects active or mismatched data-image content', async () => {
  const service = await imageService();
  const html = Buffer.from('<script>alert(1)</script>').toString('base64');
  const pngHeaderWithHtml = Buffer.from('<html></html>').toString('base64');

  await assert.rejects(
    () => service.base64ToFile(`data:image/html;base64,${html}`, 'security_test'),
    /Unsupported image type/
  );
  await assert.rejects(
    () => service.base64ToFile(`data:image/png;base64,${pngHeaderWithHtml}`, 'security_test'),
    /does not match/
  );
});
