const tcb = require('@cloudbase/node-sdk');
const wecom = require('@wecom/cloudbase-framework-plugin-node-sdk');

const suiteId = process.env.WECOM_SUITE_ID;

const app = wecom.init({
  cloudbase: tcb.init({
    env: tcb.SYMBOL_CURRENT_ENV,
    credentials: {
      private_key_id: process.env.WECOM_CUSTOM_LOGIN_PRIVATE_KEY_ID,
      private_key: process.env.WECOM_CUSTOM_LOGIN_PRIVATE_KEY,
      env_id: process.env.ENV_ID,
    },
  }),
});

const auth = app.cloudbase.auth();
const db = app.cloudbase.database();

exports.main = async (event) => {
  const suiteAccessToken = await app.getSuiteAccessToken({
    suiteId,
  });

  const userInfoRes = await app.request({
    name: 'service/getuserinfo3rd',
    query: {
      suite_access_token: suiteAccessToken,
      code: event.code,
    },
  });

  const corpId = userInfoRes.CorpId;
  const userId = userInfoRes.UserId;
  const openUserId = userInfoRes.open_userid;

  const [authInfo] = await Promise.all([
    app.getAuthInfo({ suiteId, corpId }),
    setUserInfo(openUserId, corpId, userId),
  ]);

  return {
    openUserId,
    corpId,
    userId,
    agentId: authInfo.agentId,
    ticket: auth.createTicket(openUserId),
  };
};

async function setUserInfo(openUserId, corpId, userId) {
  const collection = db.collection('my-user');
  const res = await collection
    .where({ open_userid: openUserId })
    .limit(1)
    .get();
  const original = res.data[0];
  const newItem = {
    open_userid: openUserId,
    corp_id: corpId,
    user_id: userId,
  };
  if (original) {
    // eslint-disable-next-line no-underscore-dangle
    await collection.doc(original._id).update(newItem);
  } else {
    await collection.add(newItem);
  }
}
