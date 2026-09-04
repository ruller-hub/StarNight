const autoResponses = {
  link: `_ _
_ _           ɢᴀᴍᴇ [**StarNight**](https://cdn.discordapp.com/attachments/ex=68c965be&is=68c8143e&hm=b5f95e619dd0a209c3c24dd0bac7eb5e7ae603f37d3db3c9275ac65857c51acf&) [** .ᐟ**](https://discord.gg/star-night) ɢɪᴠᴇᴀᴡᴀʏ
_ _          __Community__       \`Kurdish\`    __Staff__
-# _ _                         *starnight for everyone *
_ _`,
};

export function getAutoResponse(content) {
  const message = content.trim().toLowerCase();

  return autoResponses[message] || null;
}
