import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { readFile } from 'fs/promises';

const endpoint = 'https://littleskin.cn';
const credentials = JSON.parse(process.env.CREDENTIALS);
const headers = JSON.parse(
  await readFile(new URL('./headers.json', import.meta.url))
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extractCsrf(page) {
  const m = page.match(/<meta\\s+name="csrf-token"\\s+content="([^"]+)"/i);
  if (!m) throw new Error('CSRF token not found');
  return m[1];
}

async function task() {
  const jar = new CookieJar();
  const client = wrapper(
    axios.create({ jar, withCredentials: true, baseURL: endpoint, headers })
  );

  // 1. 登录页
  const loginPage = await client.get('auth/login');
  let csrf = extractCsrf(loginPage.data);
  await sleep(1200);

  // 2. 登录
  await client.post(
    'auth/login',
    { identification: credentials.handle, password: credentials.password, keep: false },
    { headers: { 'X-CSRF-TOKEN': csrf } }
  );
  await sleep(1200);

  // 3. 取 CSRF
  const userPage = await client.get('user');
  csrf = extractCsrf(userPage.data);
  await sleep(1200);

  // 4. 签到
  const { data } = await client.post('user/sign', null, {
    headers: { 'X-CSRF-TOKEN': csrf },
  });

  // 结果提示
  if (data.code === 0) console.log('签到成功 ✅');
  else if (data.code === 1) console.log('今日已签，跳过 ⚠️');
  else console.log('未知返回：', JSON.stringify(data));
}

// 最多重试 3 次
(async () => {
  for (let i = 0; i < 3; i++) {
    try {
      await task();
      break;
    } catch (err) {
      console.error(`第 ${i + 1} 次尝试失败`, err.message || err);
      if (i === 2) throw err;
      await sleep(2000);
    }
  }
})().catch(() => process.exit(1));
