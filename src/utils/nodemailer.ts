import nodemailer from 'nodemailer';
// import { EmailData } from './types'; // Replace with the correct path to your types file

export const sendMail = async function sendMail(str: string, data: any): Promise<void> {
  let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.NODEMAILER_EMAIL!,
      pass: process.env.NOMEMAILER_PASSWORD!,
    },
  });

  let Osubject: string = '', Ohtml: string = '';

  if (str === 'candidateSignup') {
    Osubject = `Thank you for signing up ${data.firstName}`;
    Ohtml = `
    <h1>Welcome to Cyber Levels</h1>
    Hope you have a good time getting recruited!
    <br/>
    Here are your details-
    <br/>
    Name - ${data.firstName} - ${data.lastName}
    <br/>
    Email- ${data.email}
    `;
  } else if (str === 'employerSignup') {
    Osubject = `Thankyou for signing up ${data.firstName}`;
    Ohtml = `
    <h1>Welcome to Cyber Levels</h1>
    you will have a good time recruiting!!!
    <br/>
    your details:
    Email- ${data.email}
    `;
  } else if (str === 'login') {
    Osubject = `Important!!!`
    Ohtml = `
        <h1>Urgent Attention Required</h1>
        <br/>
        Someone has logged in to your Cyber Levels account if it was not you please change your password ASAP!!!.
    `
  } else if (str === 'candidateSignupEmail') {
    Osubject = `Thank you for signing up ${data.name}`
    Ohtml = `<h1>Welcome to Cyber Levels</h1>
    Hope you have a good time getting recruited!
    <br/>
    Here are your details-
    <br/>
    Name - ${data.name}
    <br/>
    Email- ${data.email}`
  } else if (str === `employerSignupEmail`) {
    Osubject = `Thank you for signing up ${data.name}`
    Ohtml = `<h1>Welcome to Cyber Levels</h1>
    you will have a good time recruiting!!!
    <br/>
    your details:
    Email- ${data.email}`
  }

  let info = await transporter.sendMail({
    from: '"Rituj Manware 🆒" <manwarerutuj@gmail.com>', // sender address <${userObj.email}>
    to: data.email, // list of receivers
    subject: Osubject, // Subject line
    html: Ohtml, // html body
  });

  console.log('Message sent: %s', info.messageId);
};