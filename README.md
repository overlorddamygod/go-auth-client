# go-auth-client
Javascript client library for [Go-auth](https://github.com/overlorddamygod/go-auth)

## Installation

Using npm:
```shell
$ npm i go-auth-client
```
Usage
```js
import auth from "go-auth-client"

const client = auth.createClient( GO_AUTH_SERVER_URL )

// User data can be accessed from client.user if logged in
```


### How to use

#### Signing Up

```js
const {data, error} = await client.signUp("email", "username", "password")
```

#### Signing In

```js
// Sign in with Email and Password
const {data, error} = await client.signInWithEmail("email", "password")

// Sign in with MagicLink
const {data, error} = await client.signInWithMagicLink("email")

// Sign in with oauth provider 
// Supported providers : github
client.signInWithProvider("github")
```

#### SignOut

```js
const {data, error} = await client.signOut()
```

#### Auth Change Listener

```js
client.onAuthChanged((user) => {
  console.log(user)
})
```
