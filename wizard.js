const WizardScene = require('telegraf/scenes/wizard')
const Markup = require('telegraf/markup')
const Extra = require('telegraf/extra') 
const data = require('./data')

const superWizard = new WizardScene('generating', 
  ({ wizard, i18n, replyWithHTML }) => {
    replyWithHTML(i18n.t('getText'))
    return wizard.next()
  },

  ({ message, scene, wizard, session, i18n, replyWithHTML }) => {
    if (!message || !message.text) {
      return wizard.back()
    }

    if (message.text == '/start') {
      return scene.enter('generating')
    }

    replyWithHTML(i18n.t('getButton'))

    session.postText = message.text
    return wizard.next()
  },

  async ({ message, scene, wizard, session, i18n, replyWithHTML }) => {
    if (!message || !message.text || message.text.length > 15) {
      return wizard.back()
    }

    if (message.text == '/start') {
      return scene.enter('generating')
    }

    await replyWithHTML(i18n.t('check'))
    await replyWithHTML(
      session.postText,
      Extra
        .markup(Markup.inlineKeyboard([
          [Markup.callbackButton(message.text, 'leer')]
        ]))
    )
    replyWithHTML(
      i18n.t('isCorrect'),
      Extra
        .markup(Markup.inlineKeyboard([
          [
            Markup.callbackButton(i18n.t('buttons.correct'), 'correct'), 
            Markup.callbackButton(i18n.t('buttons.notCorrect'), 'again')
          ]
        ]))
    )

    return scene.leave()
  }
)

module.exports = superWizard