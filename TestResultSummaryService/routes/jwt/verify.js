const { UserDB, ObjectID } = require('../../Database');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    const token = req.headers['x-access-token'];
    if (!token) res.status(401).send({ auth: false, message: 'No token provided.' });
    //TODO: use real secret code
    const secretCode = "supersecret";
    let decoded = null;
    try {
        decoded = await jwt.verify(token, secretCode);
    } catch (err) {
        console.error(err);
        res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
        return;
    }

    if (decoded && decoded.id) {
        console.log("decoded.id", decoded.id);
        const userDB = new UserDB();
        const response = await userDB.findOne({_id: new ObjectID(decoded.id)});
        if (response) {
            // TODO: update DB with test info
            console.log("req.body", req.body);
            // TODO: send user meaningful response
            res.status(200).send(response);
        } else {
            res.status(500).send("There was a problem finding the user.");
        }
    }
}