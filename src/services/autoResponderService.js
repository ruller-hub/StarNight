const autoResponses = {
  hello: 'Hey 👋',
  hi: 'Hello!',
  rules: 'Please check the server rules.',
  sybau: '😭',
};

export function getAutoResponse(content) {
  const message = content.trim().toLowerCase();

  return autoResponses[message] || null;
}
