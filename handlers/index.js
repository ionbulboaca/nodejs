const auth = require('./authHandler');
const other = require('./otherHandler');
module.exports = {
    auth,
    ...other
};