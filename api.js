import qs from "qs";
import axios from "axios";

async function request(method, params) {
  const paramsStr = qs.stringify(params);
  const url = `${_.trimEnd(process.env.API_URL, "/")}/${method}?${paramsStr}`;

  try {
    return (
      await axios.request({
        url,
      })
    ).data;
  } catch (e) {}
}

export async function getOverwatchReport() {
  return await request("getOverwatchReport", {
    limit: 50,
  });
}

export async function updateOverwatchReport_updated_at(_id) {
  return await request("updateOverwatchReport_updated_at", { _id });
}

export async function updateOverwatchReport_banned(_id) {
  return await request("updateOverwatchReport_banned", { _id });
}

export async function updateFriend_banned(steamId) {
  return await request("updateFriend_banned", { steamId });
}

export async function getDiscordAccountHeader(account) {
  return await request("getDiscordAccountHeader", { account });
}

export async function getFriendInfo(steamId) {
  return await request("getFriendInfo", { steamId });
}
