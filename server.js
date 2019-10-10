const express = require('express');
const app = express();
app.use(express.json());
const path = require('path');
const db = require('./db');
const { User, Login } = db.models;
const jwt = require('jwt-simple');
const axios = require('axios');
const qs = require('querystring');
const session = require('express-session');

const port = process.env.PORT || 3000;
db.syncAndSeed()
  .then(()=> app.listen(port, ()=> console.log(`listening on port ${port}`)));

try{
  Object.assign(process.env, require('./.env.js'))
}catch(ex){
  console.log('error----> ', ex)
}

app.use('/dist', express.static(path.join(__dirname, 'dist')));
app.use(session({
  secret: process.env.SESSION
}))

app.get('/github/callback', (req, res, next)=> {
  axios.post('https://github.com/login/oauth/access_token', {
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    code: req.query.code
  })
    .then(resp => resp.data)
    .then(data => {
      const {access_token} = qs.parse(data);
      return axios.get('https://api.github.com/user', {
        headers: {
          authorization: `token ${access_token}`
        }
      })
        .then( resp => resp.data )
        .then( async githubUser => {
          // console.log(githubUser)
          let user = await User.findOne({ where: { githubId: githubUser.id }})
          if (user !== null){
            const token = jwt.encode({id: user.id}, process.env.SECRET)
            res.redirect(`/#token=${token}`)
          }else{
            user = await User.create({
              email: githubUser.email,
              password: '12345',
              githubId: githubUser.id
            })
            const token = jwt.encode({id: user.id}, process.env.SECRET)
            res.redirect(`/#token=${token}`)
          }
        })
    })
    .catch(next)
})

app.get('/githubLogin', (req, res, next)=>{
  const URL = `https://github.com/login/oauth/authorize?client_id=${process.env.CLIENT_ID}`
  res.redirect(URL)
})

app.use((req, res, next)=> {
  if(!req.headers.authorization){
    return next();
  }
  User.findByToken(req.headers.authorization)
    .then( user => {
      req.user = user;
      next();
    })
    .catch(next);
});

app.post('/api/sessions', (req, res, next)=> {
  User.findOne({
    where: {
      email: req.body.email,
      password: req.body.password
    }
  })
  .then( async (user) => {
    if(!user){
      throw ({ status: 401 });
    }
    await Login.create({ userId: user.id });
    return res.send({ token: jwt.encode({ id: user.id}, process.env.SECRET)});
  })
  .catch( err => next(err));
});

app.get('/api/sessions', (req, res, next)=> {
  if(req.user){
    return res.send(req.user);
  }
  next({ status: 401 });
});

app.get('/api/logins', (req, res, next)=> {
  Login.findAll({ where: { userId: req.user.id}})
    .then( logins => res.send(logins))
    .catch(next);
});

app.delete('/api/sessions', (req, res, next)=> {
  req.session.destroy();
  res.sendStatus(204);
});

app.get('/', (req, res, next)=> {
  res.sendFile(path.join(__dirname, 'index.html'))
});
