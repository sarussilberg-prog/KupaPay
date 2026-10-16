import http from 'k6/http';
import { check, sleep } from 'k6';

const supabaseUrl = (__ENV.SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = __ENV.SUPABASE_ANON_KEY || '';
const userJwt = __ENV.K6_USER_JWT || '';
const userId = __ENV.K6_USER_ID || '';
const vus = Number(__ENV.K6_VUS || 15);
const duration = __ENV.K6_DURATION || '1m';

if (!supabaseUrl || !anonKey || !userJwt) {
    throw new Error(
        'Set SUPABASE_URL, SUPABASE_ANON_KEY, and K6_USER_JWT (dev test user) before running k6.',
    );
}

export const options = {
    scenarios: {
        dashboard_rpc: {
            executor: 'constant-vus',
            vus,
            duration,
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.005'],
        'http_req_duration{rpc:get_user_dashboard}': ['p(95)<300'],
        'http_req_duration{rpc:get_user_simplified_inputs}': ['p(95)<300'],
    },
};

function rpc(name, body) {
    const url = `${supabaseUrl}/rest/v1/rpc/${name}`;
    const res = http.post(url, JSON.stringify(body), {
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
    const userId = JSON.parse(
        Buffer.from(userJwt.split('.')[1], 'base64url').toString('utf8'),
    ).sub;

    rpc('get_user_dashboard', { p_user_id: userId });
    sleep(0.2);
    rpc('get_user_simplified_inputs', { p_user_id: userId });
    sleep(0.3);
}
