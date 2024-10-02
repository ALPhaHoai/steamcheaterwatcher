import { MongoClient } from "mongodb";

export async function requireDB(callback) {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  console.log("Connected successfully to server");
  const db = client.db("SteamSupportDatabase");

  const collection = {};
  collection.MyAccount = db.collection("MyAccount");
  collection.Friend = db.collection("Friend");
  collection.FriendInfo = db.collection("FriendInfo");
  collection.DiscordAccountHeader = db.collection("DiscordAccountHeader");
  collection.OverwatchReport = db.collection("OverwatchReport");

  try {
    await callback?.(collection);
  } catch (e) {}

  await client.close(true);
  for (const collectionKey in collection) {
    delete collection[collectionKey];
  }
}
