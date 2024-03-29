const db = require("../models")
const config = require("../config/auth.config")
const {user: User, refreshToken: RefreshToken} = db
const Op = db.Sequelize.Op

var jwt = require("jsonwebtoken")
var bcrypt = require("bcryptjs")

exports.signup = (req, res) => {
    User.create({
        username: req.body.username,
        email: req.body.email,
        password: bcrypt.hashSync(req.body.password, 8)
    }).then(user => {
        res.send({message: "User was registered successfully!"})
    }).catch(err => {
        res.status(500).send({message: err.message})
    })
}

exports.signin = (req, res) => {
    User.findOne({
        where: {
            username: req.body.username
        }
    }).then(async (user) => {
        if(!user){
            return res.status(404).send({message: "User not found"})
        }
        const passwordIsValid = bcrypt.compareSync(
            req.body.password,
            user.password
        )
        if(!passwordIsValid){
            return res.status(401).send({
                accessToken: null,
                message: "Invalid Password"
            })
        }

        const token = jwt.sign({id: user.id}, config.secret,
            {
                expiresIn: config.jwtExpiration
            })
        let refreshToken = await RefreshToken.createToken(user)

        res.status(200).send({
            id: user.id,
            username: user.username,
            email: user.email,
            accessToken: token,
            refreshToken: refreshToken
        })
    }).catch(err => {
        res.status(500).send({message: err.message})
    })
}

exports.refreshToken = async (req, res) => {
    console.log("refreshtoken func used!!")
    const {refreshToken: requestToken} = req.body
    if(requestToken == null){
        return res.status(403).json({message: "Refresh Token is requires"})
    }
    try{
        let refreshToken = await RefreshToken.findOne({where:{token: requestToken}})
        if(!refreshToken){
            res.status(403).json({message: "Refresh token is not in db"})
            return
        }
        if(RefreshToken.verifyExpiration(refreshToken)){
            RefreshToken.destroy({where: {id:refreshToken.id}})

            res.status(403).json({
                message: "Refresh token was expired. Please make a new login"
            })
            return
        }

        const user = await refreshToken.getUser()
        let newAccessToken = jwt.sign({id: user.id}, config.secret, {expiresIn: config.jwtExpiration})

        return res.status(200).json({
            accessToken: newAccessToken,
            refreshToken: refreshToken.token
        })
    } catch (err){
        return res.status(500).send({message: err})
    }
}