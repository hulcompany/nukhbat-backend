import { Injectable } from '@nestjs/common';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

@Injectable()
export class FirebaseService {
  private messaging: Messaging;

  constructor() {
    if (!getApps().length) {
      const sc = require('../../service-account.json');

      initializeApp({
        credential: cert(sc),
      });
    }

    this.messaging = getMessaging();
  }

  getMessaging(): Messaging {
    return this.messaging;
  }
}
