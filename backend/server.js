require('dotenv').config()

const mongoose = require('mongoose')
mongoose.connect(process.env.DATABASE, {
    useUnifiedTopology: true,
    useNewUrlParser: true
})

mongoose.connection.on('error', (err) => {
    console.log('Mongoose Connection ERROR: ' + err.message)
})
mongoose.connection.once('open', () => {
    console.log('Mongoose Connected!')
})

require('./models/User')
require('./models/Chatroom')
require('./models/Message')

const app = require('./app')
const server = app.listen(8000, ()=> {
    console.log('Sever listening on port 8000')
})

const io = require('socket.io')(server, {
    cors: {
        origin: '*',
      }
    }
)
const jwt = require('jwt-then')
const Message = mongoose.model('Message')
const User = mongoose.model('User')

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.query.token
        const payload = await jwt.verify(token, process.env.SECRET)
        socket.userId = payload.id 
        next()
    } catch (err) {

    }
})

io.on('connection', (socket) => {
    console.log('Connected: ' + socket.userId)

    socket.on('disconnect', () => {
        console.log('Disconnected:' + socket.userId)
    })
    socket.on('joinRoom', async ({ chatroomId })=> {
        socket.join(chatroomId)
        if(chatroomId) {
            const user = await User.findOne({ _id: socket.userId})
            io.to(chatroomId).emit('userJoinRoom', {
                userName: user.name,
                status: 1
            })
            console.log("A user joined chatroom: " + user.name)
        }
    })
    socket.on("leaveRoom", async ({ chatroomId }) => {
        socket.leave(chatroomId)
        if(chatroomId) {
            const user = await User.findOne({ _id: socket.userId})
            io.to(chatroomId).emit('userLeaveRoom', {
                userName: user.name,
                status: 0
            })
            console.log("A user left chatroom: " + user.name)
        }
    })
    socket.on('chatroomMessage', async ({ chatroomId, message}) => {
        if(message.trim().length > 0) {
            const user = await User.findOne({ _id: socket.userId})
            const newMessage = new Message({
                chatroom: chatroomId,
                user: socket.userId,
                message
            })
            io.to(chatroomId).emit('newMessage', {
                message,
                name: user.name,
                userId: socket.userId
            })
            await newMessage.save()
        }
    })
})