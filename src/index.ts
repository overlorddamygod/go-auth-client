import axios, { AxiosInstance } from "axios";
import { AuthListener, Token, User } from "./types";


class goAuthClient {
  #axios: AxiosInstance;
  #authListeners: AuthListener[] = [];
  user: User | null = null;
  #refreshTimeout: NodeJS.Timeout | null = null;
  #refreshToken: Token = null;
  #accessToken: Token = null;

  constructor(url: string) {
    this.#axios = axios.create({
      baseURL: url,
    });
    this.#axios.defaults.headers.common["Content-Type"] = "application/json";
    this.#axios.defaults.headers.common["Accept"] = "application/json";

    if (typeof window != "undefined") {
      console.log("browser");
      const params = new URLSearchParams(window.location.search);
      // get tokens from query
      if (
        params.has("type") &&
        params.has("access_token") &&
        params.has("refresh_token")
      ) {
        console.log("Signing in from magic link");
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
          console.log("Signing in from persistent token");
          this.refreshUser();
        }
      }
    } else {
      console.log("NODE");
      this.#accessToken = null;
      this.#refreshToken = null;
      this.user = null;
    }
  }

  async #get(url: string, params: object = {}) {
    return this.#axios.get(url, { params });
  }

  async #post(url: string, data: object = {}) {
    return this.#axios.post(url, data);
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

  async signInWithMagicLink(email: string) {
    return this.#format(
      this.#post("/signin?type=magiclink&redirect_to=http://localhost:3000", {
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
    this.#accessToken = accessToken;
    this.#axios.defaults.headers.common["X-Access-Token"] = this.#accessToken as string;
    localStorage.setItem("accessToken", this.#accessToken as string);
  }

  #setRefreshToken(refreshToken: Token, addToHeader: boolean = false) {
    this.#refreshToken = refreshToken;
    if (addToHeader) {
      this.#axios.defaults.headers.common["X-Refresh-Token"] = this.#refreshToken as string;
    }
    localStorage.setItem("refreshToken", this.#refreshToken as string);
  }

  signOut() {
    const signOutRes = this.#format(
      this.#axios.post(
        "/signout",
        {},
        {
          headers: {
            "X-Refresh-Token": this.#refreshToken as string,
          },
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
      this.#axios.post(
        "/refresh",
        {},
        {
          headers: {
            "X-Refresh-Token": this.#refreshToken as string,
          },
        }
      ),
      this.#onRefreshUser.bind(this) as any,
      this.#onRefreshError.bind(this)
    );
  }

  #onRefreshUser(data: {
    "access-token": string
  }) {
    console.log("REFRESH_SUCCESS");
    this.#setAccessToken(data["access-token"] as string);
    this.#startRefreshTimeOut();
    this.getMe();
  }

  #onRefreshError(err: any) {
    console.log("REFRESH_ERROR");
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
    return this.#format(this.#get("/me"), this.#onGetMe.bind(this));
  }

  #onGetMe(data: any) {
    this.#setUser(data.user);
  }

  removeListener(listener: AuthListener) {
    this.#authListeners = this.#authListeners.filter((l) => l !== listener);
  }

  async #format(
    func: any,
    onSuccess = (obj: object = {}) => {},
    onError = (obj: object) => {}
  ): Promise<{ data: any, error: string | null}> {
    try {
      const response = await func;

      if (response.data.error) {
        onError(response.data.error);
        return {
          data: null,
          error: response.data.error,
        };
      }
      if ("data" in response) {
        onSuccess(response.data);
      } else {
        onSuccess();
      }
      return {
        data: response.data,
        error: null,
      };
    } catch (err: any) {
      if (
        err.response.data &&
        Object.keys(err.response.data).includes("error")
      ) {
        onError({
          apiErr: true,
          message: err.response.data,
        });
        return {
          data: null,
          error: err.response.data.message,
        };
      }
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
