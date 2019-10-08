const express = require('express');
const app = express();
app.use(express.json());
const path = require('path');
const db = require('./db');
const { User, Login } = db.models;
const jwt = require('jwt-simple');

const port = process.env.PORT || 3000;
db.syncAndSeed()
  .then(()=> app.listen(port, ()=> console.log(`listening on port ${port}`)));


app.use('/dist', express.static(path.join(__dirname, 'dist')));

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
  res.sendFile(path.join(__dirname, 'index.html'));
});
