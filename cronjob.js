import { CronJob } from "cron";
import { requireDB } from "./db.js";
import SteamUser from "steamutils";
import { sleep } from "steamutils/utils.js";

export const natriGuildId = "675728216597463080";
const generalChannel = "675728217037996085";
const reportCheaterChannel = "1183661640240070696";
const bannedCheaterChannel = "1242161465205719110";

export default async function initCron() {
  console.log("initCron");
  new CronJob(
    "0 5 * * * *",
    async function () {
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

          const authorsStr = report.authors
            .map((author) => `<@${author.id}>`)
            .join(" ");

          const result = await botNatriDiscordUser.sendMessage({
            channelId: generalChannel,
            content: `${authorsStr} [${summary.name}](${summary.url}) : ${banned}`,
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

        for await (const report of collection.OverwatchReport.aggregate([
          {
            $match: { banned: { $exists: false } },
          },
          { $sample: { size: 50 } },
        ])) {
          await fetchReport(report);
        }
      });
    },
    null,
    true,
    "Asia/Ho_Chi_Minh",
  ).start();
}
