import { AuthListener, Token, User } from "./types";

class goAuthClient {
  #authListeners: AuthListener[] = [];
  user: User | null = null;
  #refreshTimeout: NodeJS.Timeout | null = null;
  #refreshToken: Token = null;
  #baseUrl: string = "";
  accessToken: Token = null;

  constructor(baseUrl: string) {
    this.#baseUrl = baseUrl.replace(/\/$/, "");

    if (typeof window != "undefined") {
      // console.log("browser");
      const params = new URLSearchParams(window.location.search);
      // get tokens from query
      if (
        params.has("type") &&
        params.has("access_token") &&
        params.has("refresh_token")
      ) {
        console.log("Signing in from", params.get("type"));
        this.#setAccessToken(params.get("access_token")!);
        this.#setRefreshToken(params.get("refresh_token")!);

        if (location.href.includes("?")) {
          history.pushState({}, "", location.href.split("?")[0]);
        }

        this.getMe();
        this.#startRefreshTimeOut();
      } else {
        this.#setAccessToken(localStorage.getItem("accessToken")!);
        this.#setRefreshToken(localStorage.getItem("refreshToken")!);

        if (this.#refreshToken && this.#refreshToken.length > 20) {
          // console.log("Signing in from persistent token");
          this.refreshUser();
        }
      }
    } else {
      // console.log("NODE");
      this.accessToken = null;
      this.#refreshToken = null;
      this.user = null;
    }
  }

  async signUp(email: string, name: string, password: string) {
    return this.#format(this.#post("/signup", { email, name, password }));
  }

  async signInWithEmail(email: string, password: string) {
    return this.#format(
      this.#post("/signin?type=email", { email, password }),
      this.#onSignIn.bind(this)
    );
  }

  async signInWithProvider(provider: string) {
    const url = `${
      this.#baseUrl
    }/oauth?oauth_provider=${provider}&redirect_to=${
      window.location.protocol + "//"
    }${window.location.host}`;

    window.location.href = url;
  }

  async signInWithMagicLink(email: string) {
    return this.#format(
      this.#post(`/signin?type=magiclink&redirect_to=${window.location.host}`, {
        email,
      }),
      (data) => {
        alert("Sent magic link to your email");
      },
      (err) => {
        alert("Error sending magic link");
      }
    );
  }

  async #onSignIn(data: any) {
    this.#setAccessToken(data["access_token"]);
    this.#setRefreshToken(data["refresh_token"]);
    this.#startRefreshTimeOut();
    await this.getMe();
  }

  #startRefreshTimeOut() {
    if (this.#refreshTimeout) {
      clearTimeout(this.#refreshTimeout);
    }
    this.#refreshTimeout = setTimeout(this.refreshUser.bind(this), 3600000);
  }

  #setUser(user: User | null) {
    this.user = user;
    this.#authListeners.forEach((listener) => listener(this.user));
  }

  #setAccessToken(accessToken: Token) {
    this.accessToken = accessToken;
    localStorage.setItem("accessToken", this.accessToken as string);
  }

  #setRefreshToken(refreshToken: Token, addToHeader: boolean = false) {
    this.#refreshToken = refreshToken;
    // if (addToHeader) {
    //   // this.#axios.defaults.headers.common["X-Refresh-Token"] = this.#refreshToken as string;
    // }
    localStorage.setItem("refreshToken", this.#refreshToken as string);
  }

  signOut() {
    const signOutRes = this.#format(
      this.#post(
        "/signout",
        {},
        {
          "X-Refresh-Token": this.#refreshToken as string,
        }
      ),
      this.#onSignOut.bind(this)
    );
  }

  #onSignOut() {
    if (this.#refreshTimeout) {
      clearTimeout(this.#refreshTimeout);
    }
    this.#refreshTimeout = null;
    this.#setAccessToken(null);
    this.#setRefreshToken(null);
    this.user = null;
    this.#authListeners.forEach((listener) => listener(this.user));
  }

  async refreshUser() {
    return this.#format(
      this.#post(
        "/refresh",
        {},
        {
          "X-Refresh-Token": this.#refreshToken as string,
        }
      ),
      this.#onRefreshUser.bind(this) as any,
      this.#onRefreshError.bind(this)
    );
  }

  #onRefreshUser(data: { access_token: string }) {
    // console.log("REFRESH_SUCCESS");
    this.#setAccessToken(data["access_token"] as string);
    this.#startRefreshTimeOut();
    this.getMe();
  }

  #onRefreshError(err: any) {
    // console.log("REFRESH_ERROR");
    if (err.apiErr) {
      this.signOut();
    } else {
      console.log("SERVER ERR");
    }
  }

  onAuthChanged(listener: AuthListener) {
    this.#authListeners.push(listener);
  }

  getMe() {
    return this.#format(
      this.#get("/me", {
        "X-Access-Token": this.accessToken as string,
      }),
      this.#onGetMe.bind(this)
    );
  }

  #onGetMe(data: any) {
    this.#setUser(data.user);
  }

  removeListener(listener: AuthListener) {
    this.#authListeners = this.#authListeners.filter((l) => l !== listener);
  }

  async #get(url: string, headers: object = {}) {
    const response = await fetch(this.#baseUrl + url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
      },
    });
    return response.json();
  }

  async #post(url: string, data: object = {}, headers: object = {}) {
    const response = await fetch(this.#baseUrl + url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
      },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async #format(
    func: any,
    onSuccess = (obj: object = {}) => {},
    onError = (obj: object) => {}
  ): Promise<{ data: any; error: string | null }> {
    try {
      const data = await func;
      // console.log("RESPONSE",data)

      if (data.error) {
        onError(data.error);
        return {
          data: null,
          error: data.error,
        };
      }

      onSuccess(data);
      return {
        data,
        error: null,
      };
    } catch (err: any) {
      // console.log("ERR", err)
      onError({
        apiErr: false,
        message: err,
      });
      return {
        data: null,
        error: err.message,
      };
    }
  }
}

const createClient = (url: string) => {
  return new goAuthClient(url);
};

export default { createClient };
