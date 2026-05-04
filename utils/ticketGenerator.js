const crypto = require('crypto')

const generateTicketID = () => {
    return crypto.randomBytes(4).toString('hex').toUpperCase()
}

module.exports = {
    generateTicketID
}