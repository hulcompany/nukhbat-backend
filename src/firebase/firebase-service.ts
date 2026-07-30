// firebase/firebase.service.ts

import { Injectable } from '@nestjs/common';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class FirebaseService {
  private messaging;

  constructor() {
    if (!getApps().length) {
      const sc = require('../../service-account.json');
      initializeApp({
        credential: cert(sc),
      });
    }

    this.messaging = getMessaging();
  }

  getFirestore() {
    return this.messaging;
  }
}
