import { CronJob } from "cron";
import SteamUser from "steamutils";
import { sleep } from "steamutils/utils.js";
import DiscordUser from "discord-control";
import moment from "moment";
import { removePictographic } from "discord-control/utils.js";
import {
  getDiscordAccountHeader,
  getFriendInfo,
  getOverwatchReport,
  updateFriend_banned,
  updateOverwatchReport_banned,
  updateOverwatchReport_updated_at,
} from "./api.js";

export const natriGuildId = "675728216597463080";
const generalChannel = "675728217037996085";
const reportCheaterChannel = "1183661640240070696";
const bannedCheaterChannel = "1242161465205719110";

export default async function initCron() {
  console.log("initCron");
  new CronJob(
    "0 5 * * * *",
    async function () {
      const t1 = performance.now();

      const natriHeaders = await getDiscordAccountHeader("natri");
      if (!natriHeaders) {
        return;
      }
      const botnatriHeaders = await getDiscordAccountHeader("botnatri");
      if (!botnatriHeaders) {
        return;
      }

      const natriDiscordUser = new DiscordUser(natriHeaders);
      const botNatriDiscordUser = new DiscordUser(botnatriHeaders);

      async function fetchReport(report) {
        await updateOverwatchReport_updated_at(report._id);

        const summary = await SteamUser.getUserSummaryFromProfile(
          report.steamId,
        );
        if (!summary) {
          return;
        }

        let banned = "";
        if (summary.isVACBan === 1) {
          banned = "VAC ban";
        } else if (summary.isGameBan === 1) {
          banned = "Game ban";
        }

        if (!banned) {
          return;
        }

        await updateOverwatchReport_banned(report._id);
        await updateFriend_banned(report.steamId);

        if (Math.abs(moment().diff(moment(summary.dayLastBan), "days")) < 5) {
          const authorsStr = report.authors
            .map((author) => `<@${author.id}>`)
            .join(" ");

          const name = removePictographic(summary.name) || report.steamId;
          let content = `${authorsStr} [${name}](https://steamcommunity.com/profiles/${report.steamId}) : ${banned}`;
          const friendInfo = await getFriendInfo(report.steamId);
          const friendDiscordId = friendInfo?.discord;

          if (friendDiscordId) {
            content += ` <@${friendDiscordId}>`;
          }

          const result = await botNatriDiscordUser.sendMessage({
            channelId: generalChannel,
            content,
          });

          if (!result?.id) {
            return;
          }

          setTimeout(async function () {
            await natriDiscordUser.thumbUpMessage({
              channelId: generalChannel,
              messageId: result.id,
            });
            await natriDiscordUser.sendMessage({
              channelId: generalChannel,
              content: "lại 1 người nữa ra đi 🎶 🎵",
              reply: {
                guildId: natriGuildId,
                messageId: result.id,
              },
            });
            setTimeout(async function () {
              for (const messageId of report.messageIds) {
                await botNatriDiscordUser.thumbUpMessage({
                  channelId: reportCheaterChannel,
                  messageId,
                });
                await sleep(5000);
              }
            }, 10000);
          }, 2000);
        }
      }

      const reports = await getOverwatchReport();
      if (Array.isArray(reports)) {
        for await (const report of reports) {
          await sleep(5000);
          await fetchReport(report);
        }
      }
      const t2 = performance.now();
      console.log(`watchDiscordReportCheater took: ${t2 - t1}ms`);
    },
    null,
    true,
    "Asia/Ho_Chi_Minh",
  ).start();
}
