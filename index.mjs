import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { readFile } from 'fs/promises';

const endpoint = 'https://littleskin.cn';
const credentials = JSON.parse(process.env.CREDENTIALS);
const headers = JSON.parse(await readFile(new URL('./headers.json', import.meta.url)));

const sleep = (t) => new Promise(r => setTimeout(r, t));

function extract_csrf(page) {
  const m = page.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/i);
  if (!m) throw new Error('CSRF token not found');
  return m[1];
}

async function task() {
  const cookie_jar = new CookieJar();
  const req = wrapper(axios.create({ jar: cookie_jar, withCredentials: true, baseURL: endpoint, headers }));

  let home_page = await req.get('auth/login');
  let csrf = extract_csrf(home_page.data);
  await sleep(500);

  await req.post('auth/login', {
    identification: credentials.handle,
    password: credentials.password,
    keep: false
  }, { headers: { 'X-CSRF-TOKEN': csrf } });

  await sleep(200);
  csrf = extract_csrf((await req.get('user')).data);
  await sleep(500);

  const res = await req.post('user/sign', null, { headers: { 'X-CSRF-TOKEN': csrf } });
  console.log('签到结果：', JSON.stringify(res.data));
}

(async () => {
  for (let i = 0; i < 3; i++) {
    try {
      await task();
      break;
    } catch (e) {
      console.error(`Attempt ${i + 1} failed:`, e.message || e);
      if (i === 2) throw e;
      await sleep(10000);
    }
  }
})().catch(() => process.exit(1));
