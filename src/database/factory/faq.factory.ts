import { setSeederFactory } from 'typeorm-extension';
import { Faker } from '@faker-js/faker';
import { Faq } from '../../public-content/faqs/entity/faq.entity';

export const FaqFactory = setSeederFactory(Faq, (faker: Faker) => {
  const faq = new Faq();
  faq.title = faker.book.author();
  faq.description = faker.finance.transactionDescription();
  return faq;
});
