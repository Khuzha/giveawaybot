const Telgegraf = require('telegraf')
const mongo = require('mongodb')
const randomstring = require('randomstring')
const data = require('./data')
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')
const session = require('telegraf/session')
const Stage = require('telegraf/stage')
const Scene = require('telegraf/scenes/base')
const stage = new Stage()
const { leave } = Stage
const bot = new Telgegraf(data.token)
let db


mongo.connect(data.mongoLink, {useNewUrlParser: true}, (err, client) => {
  if (err) {
    sendError(err)
  }

  db = client.db('giway')
  bot.startPolling()
})


const newPost = new Scene('newPost')
stage.register(newPost)
const buttonText = new Scene('buttonText')
stage.register(buttonText)
const check = new Scene('check')
stage.register(check)


bot.use(session())
bot.use(stage.middleware())

bot.start((ctx) => {
  ctx.reply(
    'Hello! What do you want to do?',
    Extra
      .markup(
        Markup.keyboard(['Generate new post', 'See my posts'], { columns: 1 })
        .resize()
        .oneTime()
      )
    )
})

bot.hears('Generate new post', (ctx) => {
  ctx.scene.enter('newPost')
})

newPost.enter((ctx) => ctx.reply('Send me text of your post'))

newPost.on('text', async (ctx) => {
  ctx.session.postText = ctx.message.text

  ctx.scene.enter('buttonText')
})

buttonText.enter((ctx) => ctx.reply('Send me a text for the button (not more symbols then 15)'))

buttonText.on('text', (ctx) => {
  if (ctx.message.text.length > 15) {
    return ctx.reply('Send me a text for the button (not more symbols then 15)')
  }

  ctx.session.buttonText = ctx.message.text
  ctx.scene.enter('check')
})

check.enter(async (ctx) => {
  await ctx.reply('Check the post')
  await ctx.reply(
    ctx.session.postText,
    Extra
      .markup(Markup.inlineKeyboard([
        [Markup.callbackButton(ctx.session.buttonText, 'leer')]
      ]))
  )
  
  ctx.reply(
    'Is this post correct?',
    Extra
      .markup(Markup.inlineKeyboard([
        [Markup.callbackButton('✅ Correct', 'correct'), Markup.callbackButton('❌ Try again', 'again')]
      ]))
  )
})

bot.action('correct', async (ctx) => {
  ctx.answerCbQuery()

  let tokenExist = true
  let token
  
  while (tokenExist) {
    token = randomstring.generate(16)
    const dbTokens = await db.collection('allPosts').find({token: token}).toArray()
    dbTokens.length === 0 ? tokenExist = false : false
  }
  
  ctx.reply(
    `Your post is ready. Type in your channel <code>@GiWayBot ${token}</code> to share it.`,
    Extra 
      .markup(Markup.inlineKeyboard([
        [Markup.switchToChatButton('⤴️ Share', `@GiWayBot ${token}`)]
      ]))
      .HTML()
  )

  db.collection('allPosts').insertOne({
    token: token,
    postText: ctx.session.postText,
    buttonText: ctx.session.buttonText,
    members: []
  })
})

bot.on('inline_query', async (ctx) => {
  if (ctx.inlineQuery.query.length !== 16) {
    return 
  }

  const dbData = await db.collection('allPosts').find({token: ctx.inlineQuery.query}).toArray()
  if (dbData.length === 0) {
    
  }

  const post = [{
    type: 'article',
    id: dbData[0].token,
    title: dbData[0].postText.substr(0, 20) + '...',
    input_message_content: {
      message_text: dbData[0].postText,
      parse_mode: 'html'
    },
    reply_markup: {
      inline_keyboard: [[{text: dbData[0].buttonText, callback_data: `part_${dbData[0].token}`}]]
    }
  }]

  ctx.answerInlineQuery(post)
})

bot.action(/part_*/, async (ctx) => {
  ctx.answerCbQuery('Иди на хуй', true)
})

bot.action('again', (ctx) => {
  ctx.answerCbQuery()
  ctx.scene.enter('newPost')
})