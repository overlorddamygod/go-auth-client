import axios from "axios";

class goAuthClient {
  constructor(url) {
    this.axios = axios.create({
      baseURL: url,
    });
    this.axios.defaults.headers.common["Content-Type"] = "application/json";
    this.axios.defaults.headers.common["Accept"] = "application/json";
    this.authListeners = [];

    if (typeof window != 'undefined') {
        console.log("browser")
        this.accessToken = localStorage.getItem("accessToken")
        this.refreshToken = localStorage.getItem("refreshToken")
        this.axios.defaults.headers.common["X-Access-Token"] = this.accessToken;
        this.refreshUser()
    } else {
        console.log("NODE")
        this.accessToken = null;
        this.refreshToken = null;
        this.user = "";
    }
  }

  async get(url, params) {
    return this.axios.get(url, { params });
  }

  async post(url, data) {
    return this.axios.post(url, data);
  }

  async put(url, data) {
    return this.axios.put(url, data);
  }

  async delete(url, data) {
    return this.axios.delete(url, data);
  }

  async signUp(email, name, password) {
    return this.format(this.post("/signup", { email, name, password }));
  }

  async signIn(email, password) {
    return this.format(
      this.post("/signin", { email, password }),
      this.onSignIn.bind(this)
    );
  }

  async onSignIn(data) {
    this.accessToken = data["access-token"];
    this.refreshToken = data["refresh-token"];
    this.axios.defaults.headers.common["X-Access-Token"] = this.accessToken;
    await this.getMe()
  }

  signOut() {
    this.accessToken = null;
    this.refreshToken = null;
    this.axios.defaults.headers.common["X-Access-Token"] = null;
    this.user = null;
    this.authListeners.forEach((listener) => listener(this.user));
  }

  async verifyUser() {
    return this.format(this.post("/verify", {}));
  }

  async refreshUser() {
    return this.format(this.axios.post("/refresh", {}, { headers: {
        "X-Refresh-Token": this.refreshToken,
    }}), this.onRefreshUser.bind(this));
  }

  onRefreshUser(data) {
    this.accessToken = data["access-token"];
    this.axios.defaults.headers.common["X-Access-Token"] = this.accessToken;
    this.getMe()
  }

  onAuthChanged(listener) {
    this.authListeners.push(listener);
  }

  getMe() {
    return this.format(this.get("/me"), this.onGetMe.bind(this));
  }

  onGetMe(data) {
    this.user = data.user;
    this.authListeners.forEach((listener) => listener(this.user));
  }


  removeListener(listener) {
    this.authListeners = this.authListeners.filter((l) => l !== listener);
  }

  async format(func, onSuccess = () => {}, onError = () => {}) {
    try {
      const response = await func;

      if (response.data.error) {
        onError(response.data.error);
        return {
          data: null,
          error: response.data.error,
        };
      }
      onSuccess(response.data);
      return {
        data: response.data,
        error: null,
      };
    } catch (err) {
      if (Object.keys(err.response.data).includes("error")) {
        onError(err.response.data);
        return {
          data: null,
          error: err.response.data.message,
        };
      }
      onError(err);
      return {
        data: null,
        error: err.message,
      };
    }
  }
}

const createClient = (url) => {
  return new goAuthClient(url);
};


const func = async () => {
  const client = createClient("http://localhost:8080/api/v1/auth");

  // try {

//   const [ data, err ] = await client.signUp("ov2e1222rlor1d1.dam1ygod@gmail.com", "sad", "sadmanwhocares");
  // console.log(data, err)
  client.onAuthChanged((user) => {
    console.log("CHANGED",user);
  });
  const a = await client.signIn(
    "overlord.damygod@gmail.com",
    "overlord789"
  );
//   console.log(data, err)
  // console.log(client)
//   const { data, error } = await client.verifyUser();
//   console.log(data, error);
    // const l = await client.refreshUser()
    // console.log(l)
  await client.signOut();
  // } catch(err) {

  //     console.log( err.response)
  // }
};

func();



export default { createClient };