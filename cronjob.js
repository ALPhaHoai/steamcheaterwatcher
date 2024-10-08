import { CronJob } from "cron";
import { requireDB } from "./db.js";
import SteamUser from "steamutils";
import { sleep } from "steamutils/utils.js";
import DiscordUser from "discord-control";
import moment from "moment";

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
      await requireDB(async function (collection) {
        async function getDiscordAuthorization(account) {
          return (await collection.DiscordAccountHeader.findOne({ account }))
            ?.headers;
        }

        const natriDiscordUser = new DiscordUser(
          await getDiscordAuthorization("natri"),
        );
        const botNatriDiscordUser = new DiscordUser(
          await getDiscordAuthorization("botnatri"),
        );

        async function fetchReport(report) {
          await collection.OverwatchReport.updateOne(
            { _id: report._id },
            {
              $set: {
                updated_at: Date.now(),
              },
            },
          );

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

          await collection.OverwatchReport.updateOne(
            { _id: report._id },
            {
              $set: {
                banned: true,
              },
            },
          );

          await collection.Friend.updateOne(
            { steamId: report.steamId },
            {
              $set: {
                banned: true,
              },
            },
          );

          if (Math.abs(moment().diff(moment(summary.dayLastBan), "days")) < 5) {
            const authorsStr = report.authors
              .map((author) => `<@${author.id}>`)
              .join(" ");

            let content = `${authorsStr} [${summary.name.replaceAll(/\p{Extended_Pictographic}/gu, "")}](https://steamcommunity.com/profiles/${report.steamId}) : ${banned}`;
            const friendDiscordId = (
              await collection.FriendInfo.findOne({ steamId: report.steamId })
            )?.discord;
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

        for await (const report of await collection.OverwatchReport.aggregate([
          {
            $match: { banned: { $ne: true } },
          },
          { $sort: { updated_at: 1 } },
          { $limit: 50 },
        ])) {
          await fetchReport(report);
        }
      });
      const t2 = performance.now();
      console.log(`watchDiscordReportCheater took: ${t2 - t1}ms`);
    },
    null,
    true,
    "Asia/Ho_Chi_Minh",
  ).start();
}
