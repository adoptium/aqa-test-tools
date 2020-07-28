const { UserDB } = require('../../Database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
    const { name, email, company, password } = req.body;
    if (name && email && company && password) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userDB = new UserDB();
        // TODO: need to check if user is created
        const result = await userDB.populateDB({ name, email, company, hashedPassword });

        if (result && result.insertedCount === 1) {
            //TODO: use real secret code
            const secretCode = "supersecret";
            // create a token
            const token = jwt.sign({ id: result.ops[0]._id }, secretCode, {
                expiresIn: 86400 // expires in 24 hrs
            });
            res.status(200).send({ auth: true, token: token });
        } else {
            res.status(500).send("There was a problem registering the user.")
        }
    }
}