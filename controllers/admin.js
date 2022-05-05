const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const Sequelize = require('sequelize');

const Users = require('../models/users');
const Programs = require('../models/programs');
const Trainings = require('../models/trainings');
const ExerciseDatas = require('../models/exerciseDatas');
const Exercises = require('../models/exercises');

const defaultExercises = require('../utils/exercises.json');

const getErrors = req => {
  let error = req.flash('error');
  if (error.length > 0) {
    error = error[0];
  } else {
    error = null;
  }
  return error;
};

const sortArray = array => {
  return array.sort((a, b) => {
    return a.createdAt - b.createdAt;
  });
};

const allEqual = arr => arr.every(v => v === arr[0]);

const getExerciseIds = exerciseIds => {
  let ids;
  if (exerciseIds.length > 1) {
    ids = exerciseIds.split(',');
    return ids.filter(id => id !== '');
  } else {
    return exerciseIds;
  }
};

const getExerciseData = (exerciseData, minimize = true) => {
  const schema = exerciseData.schema.split('-');
  let stats = exerciseData.performances.split('/');
  if (minimize) {
    const set = [];
    const reps = [];
    const rest = [];
    schema.forEach(el => {
      const schemaArray = el.split(',');
      set.push(schemaArray[0]);
      reps.push(schemaArray[1]);
      rest.push(schemaArray[2]);
    });
    const exerciseDatas = {
      id: exerciseData.id,
      name: exerciseData.name,
      muscleTarget: exerciseData.muscleTarget,
      type: exerciseData.type,
      set: Math.max(...set),
      reps: allEqual(reps) ? reps[0] : reps.join(', '),
      rest: allEqual(rest) ? rest[0] : rest.join(', '),
      notes: exerciseData.notes,
      TrainingId: exerciseData.trainingId,
      finished: exerciseData.finished,
    };
    return exerciseDatas;
  } else {
    const schemaData = [];
    schema.forEach(el => {
      const schemaArray = el.split(',');
      const dataObject = {};
      dataObject.set = schemaArray[0];
      dataObject.reps = schemaArray[1];
      dataObject.rest = schemaArray[2];
      schemaData.push(dataObject);
    });
    const set = [];
    const reps = [];
    const rest = [];
    schema.forEach(el => {
      const schemaArray = el.split(',');
      set.push(schemaArray[0]);
      reps.push(schemaArray[1]);
      rest.push(schemaArray[2]);
    });
    const performance = [];
    // {date: date, stats:[{set: 1, reps: 10, weight: 100, rest: 60}, {set: 2, reps: 10, weight: 100, rest: 60}]}
    stats.forEach(stat => {
      if (stat !== '') {
        const fullStats = stat.split('-');
        const date = fullStats.shift();
        const setStat = {};
        setStat.date = date;
        setStat.stats = [];
        fullStats.forEach(fullStat => {
          const statistic = {};
          const setPerf = fullStat.split(',');
          const setNumber = setPerf[0];
          const repsNumber = setPerf[1];
          const weight = setPerf[2];
          const restTime = setPerf[3];
          statistic.set = setNumber;
          statistic.reps = repsNumber;
          statistic.weight = weight;
          statistic.rest = restTime;
          setStat.stats.push(statistic);
        });
        performance.push(setStat);
      }
    });
    const exerciseDatas = {
      id: exerciseData.id,
      name: exerciseData.name,
      muscleTarget: exerciseData.muscleTarget,
      type: exerciseData.type,
      set: Math.max(...set),
      reps: allEqual(reps) ? reps[0] : reps.join(', '),
      rest: allEqual(rest) ? rest[0] : rest.join(', '),
      schema: schemaData,
      notes: exerciseData.notes,
      performances: performance,
      TrainingId: exerciseData.trainingId,
      finished: exerciseData.finished,
    };
    return exerciseDatas;
  }
};

const getExercises = (trainingExercise, exerciseDatas) => {
  const exerciseData = { id: trainingExercise.id };
  const exerciseIds = getExerciseIds(trainingExercise.exerciseIds);
  if (exerciseIds.length > 1) {
    exerciseData.type = 'circuit';
    exerciseData.exercisesList = [];
    exerciseIds.forEach(exerciseId => {
      const exercise = exerciseDatas.find(
        exercise => exercise.id == exerciseId
      );
      const data = getExerciseData(exercise, false);
      exerciseData.finished = data.finished;
      exerciseData.exercisesList.push(data);
    });
  } else {
    exerciseData.type = 'simple';
    const exercise = exerciseDatas.find(exercise => exercise.id == exerciseIds);
    const data = getExerciseData(exercise, false);
    exerciseData.finished = data.finished;
    exerciseData.exercisesList = data;
  }
  return exerciseData;
};

exports.getDashboard = (req, res, next) => {
  let message = getErrors(req);
  const userId = req.user.id;
  Programs.findAll({ where: { UserId: userId } }).then(programs => {
    let allPrograms = [];
    if (programs.length > 0) {
      allPrograms = programs;
    }
    res.render('admin/dashboard', {
      path: '/dashboard',
      pageTitle: 'Dashboard',
      user: false,
      errorMessage: message,
      validationErrors: [],
      isAuth: true,
      programs: allPrograms,
    });
  });
};

exports.getProfile = (req, res, next) => {
  let message = getErrors(req);
  res.render('admin/profile', {
    path: '/profile',
    pageTitle: 'Mon compte',
    user: false,
    errorMessage: message,
    validationErrors: [],
    isAuth: true,
    user: req.user,
  });
};

exports.getNewProgram = (req, res, next) => {
  let message = getErrors(req);
  const programId = req.params.programId;
  const trainings = [];
  if (programId !== undefined) {
    Programs.findByPk(programId).then(program => {
      Trainings.findAll({
        where: { UserId: req.user.id, ProgramId: programId },
      }).then(trainings => {
        trainings = sortArray(trainings);
        res.render('admin/newprogram', {
          path: `/newprogram/${programId}`,
          pageTitle: `${program.name}`,
          errorMessage: message,
          validationErrors: [],
          isAuth: true,
          program,
          trainings,
        });
      });
    });
  } else {
    req.user.createProgram({}).then(program => {
      console.log('New program created');
      res.render('admin/newprogram', {
        path: '/newprogram',
        pageTitle: 'Nouveau programme',
        errorMessage: message,
        validationErrors: [],
        isAuth: true,
        program,
        trainings,
      });
    });
  }
};

exports.postNewProgram = (req, res, next) => {
  let message = getErrors(req);
  const inputValue = req.body.submitAction;
  const name = req.body.programName;
  const duration = Number(req.body.programDuration);
  const trainingNumber = Number(req.body.numberOfWorkout);
  const trainingIds = req.body.trainingIds;
  Programs.findOne({
    where: { UserId: req.user.id, id: req.body.programId },
  })
    .then(program => {
      program.name = name;
      program.duration = duration;
      program.trainingNumber = trainingNumber;
      program.trainingsIds = trainingIds;
      return program.save().then(program => {
        if (inputValue === 'Enregistrer') {
          res.redirect('/programs');
        } else {
          res.redirect(`/newtraining/${program.id}`);
        }
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getNewTraining = (req, res, next) => {
  let message = getErrors(req);
  const trainingId = req.params.trainingId;
  const programId = req.params.programId;
  const exercises = [];
  if (trainingId !== undefined) {
    Trainings.findOne({
      where: { UserId: req.user.id, ProgramId: programId, id: trainingId },
    }).then(training => {
      if (training.exerciseIds.length > 0) {
        const trainingId = training.id;
        Exercises.findAll({
          where: { UserId: req.user.id, TrainingId: trainingId },
        }).then(trainingExercises => {
          ExerciseDatas.findAll({ where: { trainingId: trainingId } }).then(
            exerciseDatas => {
              trainingExercises.forEach(trainingExercise => {
                const exercise = getExercises(trainingExercise, exerciseDatas);
                exercises.push(exercise);
              });
              return res.render('admin/newtraining', {
                path: `/newtraining`,
                prevPath: undefined,
                pageTitle: `${training.name}`,
                errorMessage: message,
                validationErrors: [],
                isAuth: true,
                training,
                exercises,
              });
            }
          );
        });
      } else {
        res.render('admin/newtraining', {
          path: `/newtraining`,
          prevPath: undefined,
          pageTitle: `${training.name}`,
          errorMessage: message,
          validationErrors: [],
          isAuth: true,
          training,
          exercises,
        });
      }
    });
  } else {
    Programs.findOne({ where: { UserId: req.user.id, id: programId } }).then(
      program => {
        program
          .createTraining({
            ProgramId: programId,
            UserId: req.user.id,
          })
          .then(training => {
            console.log('New training created');
            res.render('admin/newtraining', {
              path: '/newtraining',
              prevPath: undefined,
              pageTitle: 'Nouvelle séance',
              errorMessage: message,
              validationErrors: [],
              isAuth: true,
              training,
              exercises,
            });
          });
      }
    );
  }
};

exports.postNewTraining = (req, res, next) => {
  let message = getErrors(req);
  const inputValue = req.body.submitAction;
  const name = req.body.workoutName;
  const muscleTarget = req.body.muscleTarget;
  const exerciseIds = req.body.exercisesIds;
  Trainings.findOne({
    where: { UserId: req.user.id, id: req.body.trainingId },
  })
    .then(training => {
      training.name = name;
      training.muscleTarget = muscleTarget;
      training.exerciseIds = exerciseIds;
      return training.save().then(training => {
        switch (inputValue) {
          case 'Enregistrer':
            res.redirect(`/newprogram/${training.ProgramId}`);
            break;
          case 'Commencer':
            res.redirect(`/start/${training.id}`);
            break;
          default:
            res.redirect(`/newexercise/${training.id}`);
        }
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getNewExpressTraining = (req, res, next) => {
  let message = getErrors(req);
  const trainingId = req.params.trainingId;
  const exercises = [];
  if (trainingId !== undefined) {
    Trainings.findOne({ where: { UserId: req.user.id, id: trainingId } })
      .then(training => {
        Exercises.findAll({
          where: { UserId: req.user.id, TrainingId: training.id },
        }).then(trainingExercises => {
          ExerciseDatas.findAll({ where: { trainingId: trainingId } }).then(
            exerciseDatas => {
              trainingExercises.forEach(trainingExercise => {
                const exercise = getExercises(trainingExercise, exerciseDatas);
                exercises.push(exercise);
              });
            }
          );
          res.render('admin/newtraining', {
            path: `/newexpresstraining`,
            pageTitle: `${training.name}`,
            errorMessage: message,
            validationErrors: [],
            isAuth: true,
            training,
            exercises,
          });
        });
      })
      .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(err);
      });
  } else {
    req.user
      .createTraining({})
      .then(training => {
        console.log('New Training created');
        res.render('admin/newtraining', {
          path: `/newexpresstraining`,
          pageTitle: `Séance express`,
          errorMessage: message,
          validationErrors: [],
          isAuth: true,
          training,
          exercises,
        });
      })
      .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(err);
      });
  }
};

exports.getNewExercise = (req, res, next) => {
  let message = getErrors(req);
  const exerciseId = req.params.exerciseId;
  const trainingId = req.params.trainingId;
  if (exerciseId !== undefined) {
    ExerciseDatas.findOne({
      where: {
        id: exerciseId,
        trainingId: trainingId,
      },
    }).then(exerciseDatas => {
      Trainings.findOne({
        where: { UserId: req.user.id, id: trainingId },
      }).then(training => {
        const exerciseData = getExerciseData(exerciseDatas, false);
        res.render('admin/newexercise', {
          path: `/newexercise/${exerciseId}`,
          pageTitle: 'Modifier un exercice',
          user: false,
          errorMessage: message,
          validationErrors: [],
          isAuth: true,
          exercise: exerciseData,
          programId: training.ProgramId,
          firstExerciseSetNumber: 0,
          defaultExercises,
        });
      });
    });
  } else {
    Trainings.findOne({ where: { UserId: req.user.id, id: trainingId } }).then(
      training => {
        const exerciseData = new ExerciseDatas({
          trainingId: trainingId,
        });
        return exerciseData.save().then(exerciseData => {
          training
            .createExercise({
              UserId: req.user.id,
              exerciseIds: exerciseData.id,
            })
            .then(exercise => {
              console.log('New Exercise Created');
              res.render('admin/newexercise', {
                path: `/newexercise/${exercise.id}`,
                pageTitle: 'Ajouter un exercice',
                user: false,
                errorMessage: message,
                validationErrors: [],
                isAuth: true,
                programId: training.ProgramId,
                firstExerciseSetNumber: 0,
                exercise: exerciseData,
                defaultExercises,
              });
            });
        });
      }
    );
  }
};

exports.getNewCircuit = (req, res, next) => {
  let message = getErrors(req);
  const trainingId = req.params.trainingId;
  const firstExerciseId = req.params.exerciseId;
  const userId = req.user.id;
  Trainings.findOne({ where: { UserId: userId, id: trainingId } }).then(
    training => {
      // Find exercise Type
      Exercises.findOne({
        where: {
          TrainingId: trainingId,
          exerciseIds: { [Sequelize.Op.like]: `%${firstExerciseId}%` },
        },
      }).then(exerciseType => {
        // Create new exercise Datas
        ExerciseDatas.create({ trainingId: trainingId }).then(exercise => {
          console.log('New Exercise Created');
          // Add the id of new exercise Datas to the exercise type
          exerciseType.exerciseIds += `,${exercise.id}`;
          return exerciseType.save().then(exerciseType => {
            const exerciseIds = getExerciseIds(exerciseType.exerciseIds);
            ExerciseDatas.findOne({ where: { id: exerciseIds[0] } }).then(
              firstExerciseDatas => {
                // reset rest under sets to 0 for the first exercise
                const schema = firstExerciseDatas.schema.split('-');
                const newSchema = [];
                schema.forEach(schema => {
                  let schemaDetails = schema.split(',');
                  schemaDetails[2] = 0;
                  schemaDetails.join(',');
                  newSchema.push(schemaDetails);
                });
                firstExerciseDatas.schema = newSchema.join('-');
                return firstExerciseDatas.save().then(firstExerciseDatas => {
                  const exerciseData = getExerciseData(firstExerciseDatas);
                  const setNumber = exerciseData.set;
                  res.render('admin/newexercise', {
                    path: `/newexercise/${trainingId}/circuit/${firstExerciseId}`,
                    pageTitle: 'Lier un exercice',
                    user: false,
                    errorMessage: message,
                    validationErrors: [],
                    isAuth: true,
                    exercise,
                    programId: training.ProgramId,
                    defaultExercises,
                    firstExerciseSetNumber: setNumber,
                  });
                });
              }
            );
          });
        });
      });
    }
  );
};

exports.postNewExercise = (req, res, next) => {
  let message = getErrors(req);
  const inputValue = req.body.submitAction;
  const exerciseId = req.body.exerciseId;
  const name = req.body.exerciseName;
  const muscleTarget = req.body.muscleTarget;
  const setSchema = req.body.exerciseSchema;
  const notes = req.body.trainingNotes;
  ExerciseDatas.findByPk(exerciseId)
    .then(exerciseDatas => {
      exerciseDatas.name = name;
      exerciseDatas.muscleTarget = muscleTarget;
      exerciseDatas.schema = setSchema;
      exerciseDatas.notes = notes;
      return exerciseDatas.save();
    })
    .then(exerciseDatas => {
      const trainingId = exerciseDatas.trainingId;
      Trainings.findOne({
        where: { UserId: req.user.id, id: trainingId },
      }).then(training => {
        if (!training.exerciseIds.split(',').includes(exerciseDatas.id)) {
          training.exerciseIds += `${exerciseDatas.id},`;
        }
        return training.save().then(training => {
          if (
            inputValue === "Ajouter l'exercice" ||
            inputValue === "Modifier l'exercice"
          ) {
            if (training.ProgramId) {
              res.redirect(`/newtraining/${training.ProgramId}/${trainingId}`);
            } else {
              res.redirect(`/newexpresstraining/${trainingId}`);
            }
          } else {
            if (req.originalUrl.includes('circuit')) {
              res.redirect(
                `/newexercise/${trainingId}/circuit/${req.params.firstExerciseId}`
              );
            } else {
              res.redirect(
                `/newexercise/${trainingId}/circuit/${exerciseDatas.id}`
              );
            }
          }
        });
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getExercise = (req, res, next) => {
  let message = getErrors(req);
  const exerciseId = req.params.exerciseId;
  ExerciseDatas.findOne({ where: { id: exerciseId } })
    .then(exerciseDatas => {
      const exerciseData = getExerciseData(exerciseDatas, false);
      res.render('admin/exercise', {
        path: '/exercise',
        pageTitle: exerciseDatas.name,
        errorMessage: message,
        validationErrors: [],
        isAuth: true,
        exercise: exerciseData,
        trainingId: exerciseDatas.TrainingId,
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getExerciseStat = (req, res, next) => {
  let message = getErrors(req);
  const exerciseId = req.params.exerciseId;
  ExerciseDatas.findOne({ where: { exerciseId: exerciseId } })
    .then(exerciseDatas => {
      const exerciseData = getExerciseData(exerciseDatas, false);
      res.render('admin/exercisestat', {
        path: '/exercisestat',
        pageTitle: exerciseDatas.name,
        errorMessage: message,
        validationErrors: [],
        isAuth: true,
        exercise: exerciseData,
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getPrograms = (req, res, next) => {
  let message = getErrors(req);
  Programs.findAll({ where: { UserId: req.user.id } })
    .then(programs => {
      res.render('admin/programs', {
        path: '/programs',
        pageTitle: 'Mes programmes',
        user: false,
        errorMessage: message,
        validationErrors: [],
        isAuth: true,
        programs,
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getTrainings = (req, res, next) => {
  let message = getErrors(req);
  Trainings.findAll({ where: { UserId: req.user.id } })
    .then(trainings => {
      trainings = sortArray(trainings);
      Programs.findAll({
        where: { UserId: req.user.id },
      }).then(programs => {
        if (programs) {
          trainings.forEach(training => {
            let programName;
            if (!training.ProgramId) {
              programName = `Séance express ${training.name}`;
            } else {
              const program = programs.find(
                program => program.id === training.ProgramId
              ); // return [{ program targeted }]
              programName = `Programme ${program.name}`;
            }
            training.programName = programName;
          });
        }
        res.render('admin/trainings', {
          path: '/trainings',
          pageTitle: 'Mes entrainements',
          user: false,
          errorMessage: message,
          validationErrors: [],
          isAuth: true,
          trainings,
        });
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getProgram = (req, res, next) => {
  let message = getErrors(req);
  const programId = req.params.programId;
  Programs.findOne({
    where: { UserId: req.user.id, id: programId },
  })
    .then(program => {
      Trainings.findAll({
        where: { UserId: req.user.id, ProgramId: program.id },
      }).then(trainings => {
        trainings = sortArray(trainings);
        res.render('admin/program', {
          path: '/program',
          pageTitle: `${program.name}`,
          user: false,
          errorMessage: message,
          validationErrors: [],
          isAuth: true,
          program,
          trainings,
        });
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getTraining = (req, res, next) => {
  let message = getErrors(req);
  const trainingId = req.params.trainingId;
  const exercises = [];
  Trainings.findOne({
    where: { UserId: req.user.id, id: trainingId },
  })
    .then(training => {
      if (training.exerciseIds.length > 0) {
        const trainingId = training.id;
        Exercises.findAll({
          where: { UserId: req.user.id, TrainingId: trainingId },
        }).then(trainingExercises => {
          ExerciseDatas.findAll({ where: { trainingId: trainingId } }).then(
            exerciseDatas => {
              trainingExercises.forEach(trainingExercise => {
                const exercise = getExercises(trainingExercise, exerciseDatas);
                exercises.push(exercise);
              });
              return res.render('admin/training', {
                path: '/training/',
                pageTitle: `Entrainement`,
                user: false,
                errorMessage: message,
                validationErrors: [],
                isAuth: true,
                exercises,
              });
            }
          );
        });
      } else {
        return res.render('admin/training', {
          path: '/training/',
          pageTitle: `Entrainement`,
          user: false,
          errorMessage: message,
          validationErrors: [],
          isAuth: true,
          exercises,
        });
      }
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getStart = (req, res, next) => {
  let message = getErrors(req);
  const trainingId = req.params.trainingId;
  const exercises = [];
  Trainings.findOne({
    where: { UserId: req.user.id, id: trainingId },
  })
    .then(training => {
      const trainingId = training.id;
      Exercises.findAll({
        where: { UserId: req.user.id, TrainingId: trainingId },
      }).then(trainingExercises => {
        ExerciseDatas.findAll({ where: { trainingId: trainingId } }).then(
          exerciseDatas => {
            trainingExercises.forEach(trainingExercise => {
              const exercise = getExercises(trainingExercise, exerciseDatas);
              exercises.push(exercise);
            });
            if (training.ProgramId) {
              Programs.findByPk(training.ProgramId).then(program => {
                res.render('admin/start', {
                  path: `/start/${training.id}`,
                  pageTitle: program.name,
                  user: false,
                  errorMessage: message,
                  validationErrors: [],
                  isAuth: true,
                  training,
                  exercises,
                });
              });
            } else {
              res.render('admin/start', {
                path: `/start/${training.id}`,
                pageTitle: training.name,
                user: false,
                errorMessage: message,
                validationErrors: [],
                isAuth: true,
                training,
                exercises,
              });
            }
          }
        );
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.postStart = (req, res, next) => {
  let message = getErrors(req);
  const trainingId = req.params.trainingId;
  Trainings.findOne({ where: { UserId: req.user.id, id: trainingId } })
    .then(training => {
      training.finished = true;
      return training.save().then(training => {
        if (training.ProgramId) {
          res.redirect(`/program/${training.ProgramId}`);
        } else {
          res.redirect(`/trainings`);
        }
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getStartExercise = (req, res, next) => {
  let message = getErrors(req);
  const exerciseId = req.params.exerciseId;
  Exercises.findByPk(exerciseId)
    .then(exercise => {
      const exerciseIds = getExerciseIds(exercise.exerciseIds);
      ExerciseDatas.findAll({
        where: { id: exerciseIds },
      }).then(exerciseDatas => {
        const exerciseData = getExercises(exercise, exerciseDatas);
        return res.render('admin/startexercise', {
          path: `/startexercise/${exercise.id}`,
          pageTitle: 'Entrainement',
          user: false,
          errorMessage: message,
          validationErrors: [],
          isAuth: true,
          exercise: exerciseData,
        });
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.postStartExercise = (req, res, next) => {
  let message = getErrors(req);
  const exerciseId = req.params.exerciseId;
  const userId = req.user.id;
  const exercisePerformance = req.body.exercisePerf;
  Exercises.findOne({ where: { UserId: userId, id: exerciseId } })
    .then(trainingExercise => {
      trainingExercise.finished = true;
      trainingExercise.performances += exercisePerformance;
      return trainingExercise.save().then(exercise => {
        Exercises.findAll({ where: { TrainingId: exercise.TrainingId } }).then(
          exercises => {
            let exerciseIndex;
            exercises = sortArray(exercises);
            for (let i = 0; i < exercises.length; i++) {
              if (exercises[i].id === exercise.id) {
                exerciseIndex = i;
              }
            }
            const nextExerciseIndex = exerciseIndex + 1;
            if (
              exerciseIndex + 1 <= exercises.length - 1 &&
              exerciseIndex !== undefined
            ) {
              const nextExerciseId = exercises[nextExerciseIndex].id;
              res.redirect(`/startexercise/${nextExerciseId}`);
            } else {
              res.redirect(`/start/${exercise.TrainingId}`);
            }
          }
        );
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getStats = (req, res, next) => {
  let message = getErrors(req);
  const userId = req.user.id;
  const muscleTarget = req.params.muscleTarget;
  Exercises.findAll({ where: { UserId: userId } })
    .then(exercises => {
      if (muscleTarget === undefined) {
        let musclesTargeted = [];
        exercises.forEach(exercise => {
          const muscleTarget = exercise.muscleTarget.split(/(?:,| )+/);
          muscleTarget.forEach(muscle => {
            if (muscle !== '') {
              const muscleCapitalize =
                muscle.charAt(0).toUpperCase() + muscle.slice(1);
              musclesTargeted.push(muscleCapitalize);
            }
          });
        });
        musclesTargeted = [...new Set(musclesTargeted)];
        res.render('admin/statistic', {
          path: '/statistic',
          pageTitle: 'Mes stats',
          user: false,
          errorMessage: message,
          validationErrors: [],
          isAuth: true,
          musclesTargeted,
        });
      } else {
        const exercisesTargeted = [];
        exercises.forEach(exercise => {
          if (
            exercise.muscleTarget.includes(muscleTarget) ||
            exercise.muscleTarget.includes(muscleTarget.toLowerCase())
          ) {
            exercisesTargeted.push(exercise);
          }
        });
        return res.render('admin/statisticgroup', {
          path: '/statisticgroup',
          pageTitle: 'Mes stats',
          user: false,
          errorMessage: message,
          validationErrors: [],
          isAuth: true,
          muscleTarget,
          exercisesTargeted,
        });
      }
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(err);
    });
};

exports.getDelete = (req, res, next) => {
  const userId = req.user.id;
  const elementId = req.params.id;
  const elementToDelete = req.params.element;
  switch (elementToDelete) {
    case 'program':
      Programs.destroy({ where: { UserId: userId, id: elementId } }).then(
        result => {
          console.log('Program deleted successfully');
          res.redirect('/programs');
        }
      );
      break;
    case 'exercise':
      Exercises.findOne({
        where: {
          exerciseIds: { [Sequelize.Op.like]: `%${elementId}%` },
        },
      }).then(exercise => {
        const exerciseIds = getExerciseIds(exercise.exerciseIds);
        if (exerciseIds.length > 1) {
          const idsFiltered = exerciseIds.filter(id => id !== elementId);
          if (idsFiltered.length > 0) {
            if (idsFiltered.length === 1) {
              exercise.type = 'simple';
            }
            const idsStr = idsFiltered.join(',');
            exercise.exerciseIds = idsStr;
            exercise.save();
          } else {
            exercise.destroy();
          }
        } else {
          exercise.destroy();
        }
        const trainingId = exercise.TrainingId;
        return ExerciseDatas.destroy({ where: { id: elementId } }).then(
          result => {
            Trainings.findOne({
              where: { UserId: userId, id: trainingId },
            }).then(training => {
              const trainingExIds = training.exerciseIds.split(',');
              const updatedIds = trainingExIds.filter(id => id !== elementId);
              const updatedIdsString = updatedIds.join(',');
              training.exerciseIds = updatedIdsString;
              return training.save().then(training => {
                console.log('Exercise deleted successfully');
                if (training.ProgramId) {
                  res.redirect(
                    `/newtraining/${training.ProgramId}/${trainingId}`
                  );
                } else {
                  res.redirect(`/newexpresstraining/${trainingId}`);
                }
              });
            });
          }
        );
      });
      break;
    case 'training':
      Trainings.findOne({ where: { UserId: userId, id: elementId } }).then(
        training => {
          const programId = training.ProgramId;
          return training.destroy().then(result => {
            console.log('Training deleted successfully');
            if (programId !== null) {
              res.redirect(`/newprogram/${programId}`);
            } else {
              res.redirect(`/trainings`);
            }
          });
        }
      );
      break;
    case 'user':
      Users.destroy({ where: { UserId: userId, id: elementId } }).then(
        result => {
          Programs.destroy({ where: { UserId: userId } });
          Exercises.destroy({ where: { UserId: userId } });
          Trainings.destroy({ where: { UserId: userId } });
          req.session.destroy(err => {
            console.log('User deleted successfully');
            console.log(err);
            res.redirect('/signup');
          });
        }
      );
      break;
  }
};
