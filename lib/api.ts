import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { API_BASE_URL } from './constants';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Request interceptor to add token
    this.api.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = token;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized
          this.clearToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('w_app_token');
    }
    return null;
  }

  private clearToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('w_app_token');
    }
  }

  // Convert object to form data
  private toFormData(data: Record<string, any>): FormData {
    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && data[key] !== null) {
        if (data[key] instanceof File) {
          formData.append(key, data[key]);
        } else {
          formData.append(key, String(data[key]));
        }
      }
    });
    return formData;
  }

  // Convert object to URL encoded string
  private toUrlEncoded(data: Record<string, any>): string {
    return Object.keys(data)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
      .join('&');
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const data = this.toUrlEncoded({
      language: 'en',
      email,
      password,
    });
    
    const response = await this.api.post('login.php', data);
    return response.data;
  }

  async register(userData: {
    name: string;
    email: string;
    phone: string;
    password: string;
    gender: string;
    birth: string;
    uid: string;
    image?: File;
  }) {
    const formData = this.toFormData({
      language: 'en',
      ...userData,
    });

    const response = await this.api.post('sign_up.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async forgotPassword(email: string) {
    const data = this.toUrlEncoded({
      language: 'en',
      email,
    });
    
    const response = await this.api.post('forgot_password.php', data);
    return response.data;
  }

  // Profile endpoints
  async getProfile() {
    const data = this.toUrlEncoded({
      language: 'en',
    });
    
    const response = await this.api.post('get_profile.php', data);
    return response.data;
  }

  async updateProfile(profileData: Record<string, any>) {
    const formData = this.toFormData({
      language: 'en',
      ...profileData,
    });

    const response = await this.api.post('edit_profile.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async setupProfile(setupData: {
    height: string;
    relationship: string;
    dating_Id: string;
    socialising_Id: string;
    networking_Id: string;
    nationality: string;
    city: string;
    drink: string;
    activity: string;
    profession: string;
  }) {
    const data = this.toUrlEncoded({
      language: 'en',
      ...setupData,
    });
    
    const response = await this.api.post('set_up_profile.php', data);
    return response.data;
  }

  // Location endpoints
  async getLocations(latitude: number, longitude: number) {
    const data = this.toUrlEncoded({
      language: 'en',
      latitude,
      longitude,
    });
    
    const response = await this.api.post('get_locations.php', data);
    return response.data;
  }

  async getLocationUsers(locationId: string) {
    const data = this.toUrlEncoded({
      language: 'en',
      location_Id: locationId,
    });
    
    const response = await this.api.post('get_location.php', data);
    return response.data;
  }

  async wingIntoLocation(locationId: string) {
    const data = this.toUrlEncoded({
      language: 'en',
      location_Id: locationId,
    });
    
    const response = await this.api.post('wing_me.php', data);
    return response.data;
  }

  // Message endpoints
  async getMessages() {
    const data = this.toUrlEncoded({
      language: 'en',
    });
    
    const response = await this.api.post('get_messages.php', data);
    return response.data;
  }

  async getChat(userId: string) {
    const data = this.toUrlEncoded({
      language: 'en',
      user_Id: userId,
    });
    
    const response = await this.api.post('get_inbox.php', data);
    return response.data;
  }

  async sendMessage(receiverId: string, text: string) {
    const data = this.toUrlEncoded({
      language: 'en',
      receiver_Id: receiverId,
      text,
    });
    
    const response = await this.api.post('send_inbox.php', data);
    return response.data;
  }

  async acceptMessage(userId: string) {
    const data = this.toUrlEncoded({
      language: 'en',
      user_Id: userId,
    });
    
    const response = await this.api.post('accept_inbox.php', data);
    return response.data;
  }

  async rejectMessage(userId: string) {
    const data = this.toUrlEncoded({
      language: 'en',
      user_Id: userId,
    });
    
    const response = await this.api.post('reject_inbox.php', data);
    return response.data;
  }

  // User actions
  async blockUser(userId: string) {
    const data = this.toUrlEncoded({
      language: 'en',
      user_Id: userId,
    });
    
    const response = await this.api.post('block_user.php', data);
    return response.data;
  }

  async reportUser(userId: string) {
    const data = this.toUrlEncoded({
      language: 'en',
      user_Id: userId,
    });
    
    const response = await this.api.post('report_user.php', data);
    return response.data;
  }
}

export const api = new ApiService();
