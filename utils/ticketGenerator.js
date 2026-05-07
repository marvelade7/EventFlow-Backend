const crypto = require('crypto')

const generateTicketID = () => {
    return crypto.randomBytes(8).toString('hex').toUpperCase()
}

module.exports = {
    generateTicketID
}