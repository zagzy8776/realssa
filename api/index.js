module.exports = (req, res) => {
  res.status(200).json({ hello: 'world', time: new Date().toISOString() });
};
