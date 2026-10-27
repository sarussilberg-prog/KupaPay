import http from 'k6/http';
import { check, sleep } from 'k6';

const manifest = JSON.parse(open('./load-test-manifest.json'));

const supabaseUrl = (__ENV.SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = __ENV.SUPABASE_ANON_KEY || '';
const userJwt = __ENV.K6_USER_JWT || '';
const userId = __ENV.K6_USER_ID || '';
const vus = Number(__ENV.K6_VUS || 15);
const duration = __ENV.K6_DURATION || '1m';

if (!supabaseUrl || !anonKey || !userJwt || !userId) {
    throw new Error(
        'Set SUPABASE_URL, SUPABASE_ANON_KEY, K6_USER_JWT, and K6_USER_ID before running k6.',
    );
}
if (!supabaseUrl.includes(manifest.supabaseProjectRef)) {
    throw new Error(`Load test is dev-only (expected ref ${manifest.supabaseProjectRef}).`);
}

const p95Ms = manifest.passCriteria.p95RpcMs;
const thresholds = {
    http_req_failed: [`rate<${manifest.passCriteria.maxErrorRate}`],
};
for (const rpc of manifest.rpcs) {
    thresholds[`http_req_duration{rpc:${rpc.name}}`] = [`p(95)<${p95Ms}`];
}

export const options = {
    scenarios: {
        groups_list_hot_path: {
            executor: 'constant-vus',
            vus,
            duration,
        },
    },
    thresholds,
};

function substituteBody(body) {
    const raw = JSON.stringify(body);
    return raw.replaceAll('{{userId}}', userId);
}

function rpc(name, body) {
    const url = `${supabaseUrl}/rest/v1/rpc/${name}`;
    const res = http.post(url, substituteBody(body), {
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${userJwt}`,
            'Content-Type': 'application/json',
        },
        tags: { rpc: name },
    });
    check(res, {
        [`${name} status 200`]: (r) => r.status === 200,
    });
    return res;
}

export default function () {
    for (const entry of manifest.rpcs) {
        rpc(entry.name, entry.body);
        sleep(0.15);
    }
    sleep(0.2);
}
