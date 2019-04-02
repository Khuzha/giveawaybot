const config = require('./config')
const data = require('./data')
const { text, buttons } = require('./config')
const telegraf = require('telegraf')
const mongo = require('mongodb').MongoClient
const bot = new telegraf(data.token)
const session = require('telegraf/session')
const Stage = require('telegraf/stage')
const Scene = require('telegraf/scenes/base')
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')
let db


mongo.connect(data.mongoLink, {useNewUrlParser: true}, (err, client) => {
  if (err) {
    return sendError(err)
  }

  db = client.db('kek')

  // bot.startWebhook('/kek', null, 2105)
  bot.startPolling()
})


const stage = new Stage()

const addOrFaq = new Scene('addOrFaq')
stage.register(addOrFaq)
const forward = new Scene('forward')
stage.register(forward)

bot.use(session())
bot.use(stage.middleware())

let start = (ctx) => {
  ctx.reply(
    text.hello, 
    { reply_markup: { keyboard: buttons.hello, one_time_keyboard: true, resize_keyboard: true }}
  )

  ctx.scene.enter('addOrFaq')
}

bot.start((ctx) => {
  start(ctx)
})

bot.hears(buttons.main[0][0], (ctx) => { // == start
  start(ctx)
})

addOrFaq.hears(buttons.hello[0], async (ctx) => { // handling button 'add chan'
  ctx.session.randMess = Math.floor(Math.random() * (999999999 - 100000)) + 100000
  ctx.session.forwAskedTime = (new Date()).getTime()

  await ctx.reply(text.forwardMess)
  ctx.reply(ctx.session.randMess)

  ctx.scene.leave('addOrFaq')
  ctx.scene.enter('forward')
})

forward.on('text', async (ctx) => {
  ctx.scene.leave('forward')

  let sessDataDeleter = (ctx) => { // deletes message and time from session
    delete ctx.session.randMess
    delete ctx.session.forwAskedTime
  }

  if (!ctx.message.forward_from_chat || ctx.message.forward_from_chat.type !== 'channel') { // if forward not from channel
    return ctx.reply(
      text.frwdAgain, 
      { reply_markup: { inline_keyboard: [[{ text: 'How to do it', url: 'google.com' }]] } }
    )
  }

  if ((new Date()).getTime() - ctx.session.forwAskedTime > 100000) { // if time expired
    sessDataDeleter(ctx)
    return ctx.reply(
      text.timeExpired,
      { reply_markup: { keyboard: buttons.main, one_time_keyboard: true, resize_keyboard: true }}
    )
  }

  if (+ctx.message.text !== ctx.session.randMess) { // if messages don`t equal
    sessDataDeleter(ctx)
    return ctx.reply(
      text.notEqual 
    )
  }

  let rights = await bot.telegram.getChatMember(ctx.message.forward_from_chat.id, data.botId)
  if (rights.status !== 'administrator' && !rights.can_post_messages && !rights.can_edit_messages) { // if there are no enough rights
    return ctx.reply(
      text.rights,
      { reply_markup: { inline_keyboard: [[{ text: 'How to do it', url: 'google.com' }]] } }
    )
  }

  sessDataDeleter(ctx)
  ctx.reply(
    text.addedChan,
    { reply_markup: { keyboard: buttons.main, one_time_keyboard: true, resize_keyboard: true }}
  )
})

function sendError (err, id, nick) {
  if (!id) {
    return bot.telegram.sendMessage(data.dev, 'There`s an error! Text: ' + err)
  }

  bot.telegram.sendMessage(data.dev, 'There`s an error! Text: ' + err + '\nUser: [' + nick + '](tg://user?id=' + id + ')')
}