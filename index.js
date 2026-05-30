const { Client, GatewayIntentBits, SlashCommandBuilder, Routes } = require("discord.js");
const { REST } = require("@discordjs/rest");
const mongoose = require("mongoose");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const MONGO = process.env.MONGO;

mongoose.connect(MONGO);

// DB
const User = mongoose.model("User", new mongoose.Schema({
  userId: String,
  unit: String,
  number: String,
  prefix: String
}));

const Unit = mongoose.model("Unit", new mongoose.Schema({
  name: String,
  prefix: String
}));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// nächste freie Nummer
async function nextNumber(prefix) {
  const users = await User.find({ prefix });
  const used = users.map(u => u.number);

  for (let i = 1; i < 100; i++) {
    let n = i.toString().padStart(2, "0");
    if (!used.includes(n)) return n;
  }
}

// Commands
const commands = [
  new SlashCommandBuilder()
    .setName("dienstnummer")
    .setDescription("System")
    .addSubcommand(s =>
      s.setName("add")
        .addUserOption(o => o.setName("user").setRequired(true))
        .addStringOption(o => o.setName("einheit").setRequired(true))
    )
    .addSubcommand(s =>
      s.setName("remove")
        .addUserOption(o => o.setName("user").setRequired(true))
    )
    .addSubcommand(s =>
      s.setName("liste")
    ),

  new SlashCommandBuilder()
    .setName("einheit")
    .setDescription("Einheiten")
    .addSubcommand(s =>
      s.setName("add")
        .addStringOption(o => o.setName("name").setRequired(true))
        .addStringOption(o => o.setName("prefix").setRequired(true))
    )
    .addSubcommand(s =>
      s.setName("remove")
        .addStringOption(o => o.setName("name").setRequired(true))
    )
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();

client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  if (i.commandName === "dienstnummer") {
    const sub = i.options.getSubcommand();

    if (sub === "add") {
      const user = i.options.getUser("user");
      const unitName = i.options.getString("einheit");

      const unit = await Unit.findOne({ name: unitName });
      if (!unit) return i.reply("Einheit nicht gefunden");

      const number = await nextNumber(unit.prefix);

      await User.deleteOne({ userId: user.id });

      await User.create({
        userId: user.id,
        unit: unitName,
        number,
        prefix: unit.prefix
      });

      return i.reply(`${user.username} → ${unit.prefix}/${number}`);
    }

    if (sub === "remove") {
      const user = i.options.getUser("user");
      await User.deleteOne({ userId: user.id });

      return i.reply(`${user.username} entfernt`);
    }

    if (sub === "liste") {
      const all = await User.find();

      if (!all.length) return i.reply("Keine Daten");

      let text = "**Dienstnummern:**\n\n";

      all.forEach(u => {
        text += `${u.prefix}/${u.number} - <@${u.userId}> (${u.unit})\n`;
      });

      return i.reply({ content: text, allowedMentions: { users: [] } });
    }
  }

  if (i.commandName === "einheit") {
    const sub = i.options.getSubcommand();

    if (sub === "add") {
      await Unit.create({
        name: i.options.getString("name"),
        prefix: i.options.getString("prefix")
      });

      return i.reply("Einheit erstellt");
    }

    if (sub === "remove") {
      await Unit.deleteOne({ name: i.options.getString("name") });

      return i.reply("Einheit gelöscht");
    }
  }
});

client.login(TOKEN);
