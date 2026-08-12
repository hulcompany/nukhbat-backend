// import {
//   BadRequestException,
//   Injectable,
//   NotFoundException,
// } from '@nestjs/common';
// import { DataSource, EntityManager } from 'typeorm';
// import { UUID } from 'crypto';

// import { QuestionComponentService } from './question-component.service';
// import { QuestionFillBlankChoice } from './entity/question-fill-blank-choice.entity';
// import { QuestionFillBlankChoiceDto } from './dto/question-blank-choice.dto';

// export interface QuestionFillBlankChoiceAnswer {
//   index: number;
//   choiceId: UUID;
// }

// export interface QuestionFillBlankChoiceVerdict {
//   index: number;
//   answer: QuestionFillBlankChoice;
// }

// @Injectable()
// export class QuestionFillBlankChoiceService extends QuestionComponentService {
//   constructor(private readonly ds: DataSource) {
//     super();
//   }

//   validate(data: QuestionFillBlankChoiceDto[]) {
//     if (!data?.length) {
//       throw new BadRequestException(
//         'Fill blank choice question should have choices',
//       );
//     }

//     const indexes = data
//       .map((e) => e.index)
//       .filter((index): index is number => index !== null)
//       .filter((index, position, array) => array.indexOf(index) === position)
//       .sort((a, b) => a - b);

//     if (!indexes.length) {
//       throw new BadRequestException(
//         'Fill blank choice question should have blanks',
//       );
//     }

//     // indexes must start from 0 and be sequential
//     indexes.forEach((index, position) => {
//       if (index !== position) {
//         throw new BadRequestException(
//           'Blank indexes should start from 0 and be sequential',
//         );
//       }
//     });

//     // Every blank must have at least one correct choice
//     for (const index of indexes) {
//       const choices = data.filter((e) => e.index === index);

//       const correctChoices = choices.filter((e) => e.isCorrect);

//       if (!correctChoices.length) {
//         throw new BadRequestException(
//           `Blank ${index} should have at least one correct choice`,
//         );
//       }
//     }

//     // Global/null choices cannot be correct
//     for (const choice of data) {
//       if (choice.index === null && choice.isCorrect) {
//         throw new BadRequestException('Global choices cannot be correct');
//       }
//     }
//   }

//   async create(
//     data: {
//       id: UUID;
//       schoolId: UUID;
//       data: QuestionFillBlankChoiceDto[];
//     },
//     em?: EntityManager,
//   ) {
//     const repo =
//       em?.getRepository(QuestionFillBlankChoice) ||
//       this.ds.getRepository(QuestionFillBlankChoice);

//     this.validate(data.data);

//     await repo.insert(
//       data.data.map((e) => ({
//         questionId: data.id,
//         schoolId: data.schoolId,
//         index: e.index,
//         text: e.text,
//         isCorrect: e.isCorrect,
//       })),
//     );
//   }

//   async deleteByIds(ids: UUID[], em?: EntityManager) {
//     const repo =
//       em?.getRepository(QuestionFillBlankChoice) ||
//       this.ds.getRepository(QuestionFillBlankChoice);

//     await repo.delete(ids);
//   }

//   async verdict(
//     id: UUID,
//     answer: QuestionFillBlankChoiceAnswer[],
//   ): Promise<QuestionFillBlankChoiceVerdict[]> {
//     const repo = this.ds.getRepository(QuestionFillBlankChoice);

//     const choices = await repo.find({
//       where: {
//         questionId: id,
//       },
//       order: {
//         index: 'ASC',
//       },
//     });

//     const blanks = [
//       ...new Set(choices.filter((e) => e.index !== null).map((e) => e.index)),
//     ];

//     const result: QuestionFillBlankChoiceVerdict[] = [];

//     for (const studentAnswer of answer ?? []) {
//       if (!blanks.includes(studentAnswer.index)) {
//         throw new NotFoundException(`Blank ${studentAnswer.index} not found`);
//       }

//       const choice = choices.find(
//         (e) =>
//           e.id === studentAnswer.choiceId && e.index === studentAnswer.index,
//       );

//       if (!choice) {
//         throw new NotFoundException('Choice not found');
//       }

//       result.push({
//         index: studentAnswer.index,
//         answer: choice,
//       });
//     }

//     return result;
//   }

//   checkVerdict(
//     answer: QuestionFillBlankChoiceAnswer[],
//     choices: QuestionFillBlankChoice[],
//   ): boolean {
//     const correct = new Map<number, UUID[]>();

//     for (const choice of choices) {
//       if (choice.index !== null && choice.isCorrect) {
//         const ids = correct.get(choice.index) ?? [];

//         ids.push(choice.id);

//         correct.set(choice.index, ids);
//       }
//     }

//     if (answer.length !== correct.size) {
//       return false;
//     }

//     for (const [index, correctIds] of correct) {
//       const studentAnswer = answer.find((e) => e.index === index);

//       if (!studentAnswer) {
//         return false;
//       }

//       if (!correctIds.includes(studentAnswer.choiceId)) {
//         return false;
//       }
//     }

//     return true;
//   }
// }
